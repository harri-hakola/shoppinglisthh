const express = require('express');
const PORT = process.env.PORT || 8080;
const body_parser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

//Shopping list schema
const shopping_list_schema = new Schema({
    name: {
        type: String,
        required: true
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        req: true
    }]
});

const shopping_list_model = mongoose.model('shopping_list', shopping_list_schema);



//Product schema
const product_schema = new Schema({
    name: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    image_url: {
        type: String,
        required: true
    }

});
const product_model = mongoose.model('product', product_schema);



//User schema
const user_schema = new Schema({
    name: {
        type: String,
        required: true
    },
    shopping_lists: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'shopping_list',
        req: true
    }]
});

const user_model = mongoose.model('user', user_schema);


let app = express();


app.use(body_parser.urlencoded({
    extended: true
}));


app.use(session({
    secret: '1234qwerty',
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000000
    }
}));

app.use((req, res, next) => {
    console.log(`path: ${req.path}`);
    next();
});

const is_logged_handler = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

app.use('/css', express.static('css'))

app.use((req, res, next) => {
    if (!req.session.user) {
        return next();
    }
    user_model.findById(req.session.user._id).then((user) => {
        req.user = user;
        next();
    }).catch((err) => {
        console.log(err);
        res.redirect('login');
    });
});

//Get Shopping lists
app.get('/', is_logged_handler, (req, res, next) => {
    const user = req.user;
    user.populate('shopping_lists')
        .execPopulate()
        .then(() => {
            console.log('user:', user);
            res.write(`
        <html>
        <meta charset=utf-8>
        <link rel="stylesheet" type="text/css" href="./css/style.css">
        <body>
            <h4>Logged in as user: ${user.name}</h4>
            <form action="/logout" method="POST">
                <button type="submit">Log out</button>
            </form></br></br>
            <h4>Shopping lists:</h4>`);
            user.shopping_lists.forEach((shopping_list) => {             
                res.write(`<a href="/shopping_list/${shopping_list.id}">${shopping_list.name}</a></br></br>`);
                res.write(`<form action="delete-shopping_list" method="POST">
                <input type="hidden" name="shopping_list_id" value="${shopping_list._id}">
                <button type="submit" id="delete">Delete list</button>
            </form>`)
            });                                                                            
            res.write(`
            <form action="/add-shopping-list" method="POST"> 
                <input type="text" name="name">             
                <button type="submit">Create new shopping list</button>
            </form>       
        </body>
        </html>
        `);
            res.end();
        });
});

//Delete shopping list
app.post('/delete-shopping_list', (req, res, next) => {
    const user = req.user;
    const shopping_list_id_to_delete = req.body.shopping_list_id;

    //Remove shopping-list from user.shopping_lists
        const updated_shopping_lists = user.shopping_lists.filter((shopping_list_id) => {
            return shopping_list_id != shopping_list_id_to_delete;
        });
        user.shopping_lists = updated_shopping_lists;

    //Remove shopping-list from database
    user.save().then(() => {
        shopping_list_model.findByIdAndRemove(shopping_list_id_to_delete).then(() => {
            res.redirect('/');
        });
    });
});

//Delete product
app.post('/delete-product', (req, res, next) => {   
    const shopping_list = req.shopping_list;
    const product_id_to_delete = req.body.product_id;
    const shopping_list_id = req.body.shopping_list_id;  
   
        product_model.findByIdAndRemove(product_id_to_delete).then(() => {
            res.redirect(`/shopping_list/${shopping_list_id}`)           
        });   
});


//ShoppingList page
app.get('/shopping_list/:id', is_logged_handler, (req, res, next) => {
     const id = req.params.id;
     shopping_list_model.findOne({
         _id: id
     }).then((shopping_list) => {
         shopping_list.populate('products')
         .execPopulate()
         .then(() => {          
             res.write(`                                              
                    <html>
                    <meta charset=utf-8>
                    <link rel="stylesheet" type="text/css" href="../css/style.css">
                        <body>
                        <h1>Shopping-list application</h1>
                        <h2><a href="/">Home</a></h2>
                        <br>
                        <h3>Shopping list name: ${shopping_list.name} </h3>`);
                           
             res.write(`                      
                        <table>
                            <tr>
                                <th>Product:</th>
                                <th>Quantity:</th>
                                <th>Image:</th>                                
                            </tr>`)
                            shopping_list.products.forEach((product) => {                                 
                             res.write(`    
                            <tr>
                                <td>${product.name}</td>
                                <td>

                                <form action="/product-quantity" method="POST">
                                <input type="number" name="quantity" value="${product.quantity}">
                                <input type="hidden" name="product_id" value="${product._id}">
                                <input type="hidden" name="shopping_list_id" value="${shopping_list._id}">                            
                                <button type="submit">Update</button>                             
                                </form>
                                </td>
                                <td><img src="${product.image_url}" alt="kuva"></td>
                                <td>

                                <form action="/delete-product" method="POST">
                                <input type="hidden" name="product_id" value="${product._id}">
                                <input type="hidden" name="shopping_list_id" value="${shopping_list._id}">
                                <button type="submit" id="delete">Delete product</button></form>
                                </td>
                            </tr> `)
                        });
                    
                        res.write(`
                        </table>
                                                             
            
                    <form action="/add-product" method="POST">
                <div>Product name:<br><input type="text" name="name"></div>
                <div>Quantity:<br><input type="number" name="quantity"</div>
                <div>Image url:<br><input type="text" name="image_url" value="https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcR3CC6a9Je41GSKvu8C9L5xL3oS5EuPoCFTU6JU-FZHk6PoddIh"></div>
                 <button type="submit">Add product</button>
                 <input type="hidden" name="shopping_list_id" value="${shopping_list._id}">
            </form>
                </body>
            </html>
            `);
            res.end();
        });              
    });
});

//Add Shopping-list
app.post('/add-shopping-list', (req, res, next) => {
    const user = req.user;

    let new_shopping_list = shopping_list_model({
        name: req.body.name      
    });
    new_shopping_list.save().then(() => {
        console.log('shopping-list saved');
        user.shopping_lists.push(new_shopping_list);
        user.save().then(() => {
            return res.redirect('/');
        });
    });
});

//Add product to shopping-list
app.post('/add-product', (req, res, next) => {    
    const user = req.user;
    const shopping_list_id = req.body.shopping_list_id;
   
     let new_product = product_model({
         name: req.body.name,       
         quantity: req.body.quantity,
         image_url: req.body.image_url  
        });    
        new_product.save().then(() => {
            console.log('product saved');       
          shopping_list_model.findOne({
              _id: shopping_list_id
          }).then((shopping_list) => {
              shopping_list.products.push(new_product);
           
              shopping_list.save().then(() => {                   
                  return res.redirect(`/shopping_list/${shopping_list_id}`);                
             });
          });
      })
 });


 //Change product quantity
  app.post('/product-quantity', (req, res, next) => {
     const product_id = req.body.product_id;
     const updated_quantity = req.body.quantity;
     const shopping_list_id = req.body.shopping_list_id;

     product_model.findOne({
         _id: product_id
     }).then((product) => {
         product.quantity = updated_quantity;
         product.save().then (() => {
             return res.redirect(`/shopping_list/${shopping_list_id}`);
         });        
  });
 });


//Logout
app.post('/logout', (req, res, next) => {
    req.session.destroy();
    res.redirect('/login');
});

//Login page
app.get('/login', (req, res, next) => {
    console.log('user: ', req.session.user)
    res.write(`
    <html>
    <meta charset=utf-8>
    <link rel="stylesheet" type="text/css" href="./css/style.css">
    <body>
        <form action="/login" method="POST">
           <div class="center"><input type="text" name="user_name">
            <button type="submit">Log in</button></div>
        </form>
        <form action="/register" method="POST">
            <div class="center"><input type="text" name="user_name">
            <button type="submit">Register</button></div>
        </form>
    </body>
    <html>
    `);
    res.end();
});

//User login
app.post('/login', (req, res, next) => {
    const user_name = req.body.user_name;
    user_model.findOne({
        name: user_name
    }).then((user) => {
        if (user) {
            req.session.user = user;
            return res.redirect('/');
        }
        res.redirect('/login');
    });
});

//User registration
app.post('/register', (req, res, next) => {
    const user_name = req.body.user_name;

    user_model.findOne({
        name: user_name
    }).then((user) => {
        if (user) {
            console.log('User name already registered');
            return res.redirect('/login');
        }

        let new_user = new user_model({
            name: user_name,
            shopping_lists: []
        });

        new_user.save().then(() => {
            return res.redirect('/login');
        });

    });
});

app.use((req, res, next) => {
    res.status(404);
    res.send(`
        page not found
    `);
});



const mongoose_url = 'mongodb+srv://shoppinglistdb:F0vsPryLOTibdSlJ@cluster0-gdkar.mongodb.net/test?retryWrites=true&w=majority';
mongoose.connect(mongoose_url, {
    useUnifiedTopology: true,
    useNewUrlParser: true
}).then(() => {
    console.log('Mongoose connected');
    console.log('Start Express server');
    app.listen(PORT);
});