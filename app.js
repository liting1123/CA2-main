const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });
// Database connection
const db = mysql.createConnection({
    host: 'glpfrl.h.filess.io',
    user: 'CA2_sumtopwar',
    password: '2d8a6da63a6676e514d71a0955e42fb8d4ddd4c7',
    database: 'CA2_sumtopwar',
    port: 3307
});

db.connect((err) => {
    if (err) {
        console.error('Database connection error:', err);
        throw err; // Still throw to stop the app if connection fails
    }
    console.log('Connected to Food Service database');
});
 
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());
 
// Setting up EJS
app.set('view engine', 'ejs');
 
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view !!!!!');
        res.redirect('/login');
    }
};
 
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') { 
        return next();
    } else {
        req.flash('error', 'Sorry ,Access denied!');
        res.redirect('/dashboard');
    }
};
 

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success')});
});
 
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});
 
 
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;
 
    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]+$/;
    if (!strongPasswordRegex.test(password)) {
        req.flash('error', 'Password must include at least one uppercase letter, one lowercase letter, ' +
        'one digit, and one special character (!@#$%^&*).');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};
 
app.post('/register',validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role} = req.body;
 
    const sql = 'INSERT INTO user (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            console.error("Error during user registration:", err); // Log registration errors too
            req.flash('error', 'Registration failed. Please try again or use a different email.');
            return res.redirect('/register');
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});
 
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'), 
        errors: req.flash('error')      
    });
});
 
app.post('/login', (req, res) => {
    const { email, password } = req.body;
 
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }
 
    const sql = 'SELECT * FROM user WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error("Error during login query:", err); 
            req.flash('error', 'An error occurred during login. Please try again.');
            return res.redirect('/login');
        }
 
        if (results.length > 0) {
            // Successful login
            req.session.user = results[0];           
            req.flash('success', 'Login successful! You can start order your food now.');
            res.redirect('/dashboard');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});
 

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});
 
// Menu 
app.get('/menu', (req,res) => {
    const category = req.query.category;
    let sql = 'SELECT idmenuItems,name,image,quantity,price,category from menuItems';
    let params = [];

    if (category && category.trim() !== '') {
        sql += ' WHERE category LIKE ?';
        params.push('%' + category + '%');
    }
    
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error fetching menu items:' ,error);
            return res.status(500).send('Error fetching menu items');
            
            }
        res.render('menu', { 
            food: results,
            user: req.session.user,
            category: category
             
        }); 
    });
         
});
 
// Inventory
app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT idmenuItems, name, image, quantity, price, category FROM menuItems';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error fetching menu items:', error);
            return res.status(500).send('Error fetching menu items');
        }

        res.render('inventory', {
            food: results,
            user: req.session.user
        });
    });
});

 

// View each menu item by id
app.get('/food/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * from menuItems WHERE idmenuItems = ?';
             db.query(sql, [id],(error, results) => {
        if (error) {
            console.error('Error fetching menu items:' ,error);
            return res.status(500).send('Error fetching menu items');
            
            }
        res.render('food', { food: results[0],
            user: req.session.user}
            
        ); 
    }); 
         
});

app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const idmenuItems = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;

    db.query('SELECT * FROM menuItems WHERE idmenuItems = ?', [idmenuItems], (error, results) => {
        if (error) {
            console.error('Error fetching menu item for cart:', error); 
            throw error; 
        }

        if (results.length > 0) {
            const menuItems = results[0];

            // Initialize cart in session if not exists
            if (!req.session.cart) {
                req.session.cart = [];
            }

            // Check if food already in cart
            const existingItem = req.session.cart.find(item => item.idmenuItems === idmenuItems);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                req.session.cart.push({
                    idmenuItems: menuItems.idmenuItems,
                    name: menuItems.name,
                    price: menuItems.price,
                    quantity: quantity,
                    image: menuItems.image
                });
            }

            res.redirect('/cart');
            } else {
                res.status(404).send("Menu not found");
            }
        });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
});

app.post('/deleteCart/:idmenuItems', (req, res) => {
    const itemId = req.params.idmenuItems;

    req.session.cart = req.session.cart.filter(item => item.idmenuItems != itemId);

    res.redirect('/cart');
});


app.post('/placeOrder', async (req, res) => {
    let rawCartItems = req.body.cartItems;
    let cartItemsData = [];
    let connection;

    try {
        // Step 1: Parse and validate raw cart data from the request body
        if (!rawCartItems || (Array.isArray(rawCartItems) && rawCartItems.length === 0)) {
            req.flash('error', 'Your cart is empty. Please add items before placing an order.');
            return res.redirect('/cart');
        }

        // Ensure rawCartItems is an array for consistent processing
        if (!Array.isArray(rawCartItems)) {
            rawCartItems = [rawCartItems]; // Convert single item to an array
        }

        for (const itemString of rawCartItems) {
            if (typeof itemString !== 'string' || itemString.trim() === '') {
                continue;
            }
            cartItemsData.push(JSON.parse(itemString));
        }

        if (cartItemsData.length === 0) {
            req.flash('error', 'No valid items found in your cart after processing.');
            return res.redirect('/cart');
        }

        const userId = req.session.user ? req.session.user.iduser : null;
        let totalAmount = 0;

        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Step 3: Validate each cart item against the database and calculate total
        const validatedCartItems = [];
        for (const item of cartItemsData) {
            // Fix property casing: use idmenuItems (camelCase) consistently
            const idmenuItems = item.idmenuItems || item.idmenuitems;
            const [productRows] = await connection.execute(
                'SELECT idmenuItems, name, price, image FROM menuItems WHERE idmenuItems = ?',
                [idmenuItems]
            );

            if (productRows.length === 0) {
                throw new Error(`Product with ID ${idmenuItems} not found in menu.`);
            }

            const product = productRows[0];
            const quantity = parseInt(item.quantity, 10);

            if (isNaN(quantity) || quantity <= 0) {
                throw new Error(`Invalid quantity for product ${product.name}.`);
            }

            validatedCartItems.push({
                idmenuItems: product.idmenuItems,
                name: product.name,
                image: product.image,
                quantity: quantity,
                price: product.price // Use database price for total and storage
            });
            totalAmount += quantity * product.price;
        }

        // Step 4: Insert into `orders` table
        const insertOrderSql = `
            INSERT INTO orders (iduser, total_amount, order_date, status)
            VALUES (?, ?, NOW(), 'pending')
        `;
        const [orderResult] = await connection.execute(insertOrderSql, [userId, totalAmount]);
        const orderId = orderResult.insertId;

        // Step 5: Insert each item into `orderItems` table
        // REMINDER: Ensure 'price_at_time_of_order' column exists in your orderItems table.
        const insertOrderItemSql = `
            INSERT INTO orderItems (idorder, idmenuItems, name, image, quantity, price_at_time_of_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        for (const item of validatedCartItems) {
            await connection.execute(insertOrderItemSql, [
                orderId,
                item.idmenuItems,
                item.name,
                item.image,
                item.quantity,
                item.price
            ]);
        }

        await connection.commit();
        req.session.cart = [];
        req.flash('success', 'Your order has been placed successfully!');
        res.redirect(`/orderConfirmation/${orderId}`);

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error placing order:', error.message); 
        req.flash('error', `There was an error placing your order: ${error.message}. Please try again.`);
        res.redirect('/cart');
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

//Order Confirmation
app.get('/orderConfirmation/:idorder', checkAuthenticated, async (req, res) => {
    const idorder = req.params.idorder;
    const iduser = req.session.user ? req.session.user.iduser : null;

    let connection;
    try {
        connection = await db.promise().getConnection();

        const [orderRows] = await connection.execute('SELECT * FROM orders WHERE idorder = ? AND iduser = ?', [idorder, iduser]);
        const order = orderRows[0];

        if (!order) {
            req.flash('error', 'Order not found or you do not have permission to view it.');
            return res.redirect('/dashboard');
        }

        const [itemRows] = await connection.execute(
            `SELECT oi.idorderItems, oi.idorder, oi.idmenuItems, oi.name AS product_name, oi.image AS image_url, oi.quantity
             FROM orderItems oi WHERE oi.idorder = ?`,
            [idorder]
        );
        order.items = itemRows;

        res.render('orderConfirmation', {
            user: req.session.user,
            order: order,
            successMessages: req.flash('success'),
            errorMessages: req.flash('error')
        });
    } catch (error) {
        console.error('Error fetching order confirmation:', error);
        req.flash('error', 'Could not retrieve order details. Please try again later.');
        res.redirect('/dashboard');
    } finally {
        if (connection) connection.release();
    }
});

app.get('/addInventory', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addInventory', {user: req.session.user } ); 
});

app.post('/addInventory', upload.single('Images'), (req, res) => {
    const { name, quantity, price, category } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; 
    } else {
        image = null;
    }

    const sql = 'INSERT INTO menuItems (name, image, quantity, price, category) VALUES (?, ?, ?, ?,?)';
    db.query(sql, [name, image, quantity, price, category], (error, results) => {
        if (error) {
            console.error("Error adding menu to database:", error);
            res.status(500).send(`Error adding menu: ${error.message || error}`); 
        } else {
            res.redirect('/inventory');
        }
    });
});

app.get('/editInventory/:id',(req,res) => {
    const idmenuItems = req.params.id;
    const sql = 'SELECT * FROM menuItems WHERE idmenuItems = ?';

    db.query( sql , [idmenuItems], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving Food by ID');
        }

        if (results.length > 0 ) {
            res.render('editInventory', { menuItems: results[0],user: req.session.user });
        } else {
            res.status(404).send('Order not found');
        }
    });
});

app.post('/editInventory/:id',upload.single('image'), (req,res) => {
    const idmenuItems = req.params.id;
    const {name, Image, quantity , price, category} = req.body;
    
    let image = req.body.currentImageName;
    if(req.file) image = req.file.filename;
    
    const sql = 'Update menuItems SET name =?,image = ?, quantity =? , price = ?, category = ?  WHERE idmenuItems = ?';
    db.query(sql, [ name, image, quantity, price, category,idmenuItems], (error, result) => {
        if (error){
            console.error('Update error:', error);
            return res.status(500).send('Error updating food item');
    }else{
        res.redirect('/inventory');
}
    });
}); 

app.get('/deleteInventory/:id', (req,res) => {
    const idmenuItems = req.params.id;
    const sql = 'DELETE FROM menuItems WHERE idmenuItems = ?';
    db.query( sql, [idmenuItems], (error, results) => {
        if (error) {
            console.error("Error deleting inventory:", error);
            res.status(500).send('Error deleting inventory');
        } else {
            res.redirect('/inventory');
        }
    }); 
});

app.get('/payment', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];

    let total = 0;
    for (const item of cart) {
        total += item.price * item.quantity;
    }

    res.render('payment', {
        user: req.session.user,
        total: total,
        cart: cart,
        messages: req.flash('error')
    });
});


app.post('/payment', checkAuthenticated, (req, res) => {
    const { cardNumber, expiryDate, cvv } = req.body;   
    if (!cardNumber || !expiryDate || !cvv) {
        req.flash('error', 'All payment fields are required.');
        return res.redirect('/payment');
    }   

    req.flash('success', 'Payment successful! Your order is being processed.');
    req.session.cart = [];
    res.redirect('/dashboard');
});

app.post('/processPayment', (req, res) => {
    const { cardNumber, expiryDate, cvv, amount } = req.body;
    if (!cardNumber || !expiryDate || !cvv || !amount) {
        req.flash('error', 'All payment fields are required.');
        return res.redirect('/payment');
    }
    console.log('Processing payment for card:', cardNumber);

    req.session.cart = [];
    res.render('paymentSuccess', {
        user: req.session.user,
        amount: amount
    });
});

// Starting the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Foodiess is running on http://localhost:${PORT}`);
});
