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
        req.flash('error', 'Sorry, Access denied!');
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
    
    db.query(sql,params, (error, results) => {
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

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
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

app.post('/deleteCart/:idmenuItems', (req, res) => {
    const itemId = req.params.idmenuItems;
    req.session.cart = req.session.cart.filter(item => item.idmenuItems != itemId);
    res.redirect('/cart');
});

app.post('/placeOrder', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    const body = req.body;
    const cartItems = [];

    for (let i = 0; i < 100; i++) {
      if (!body[`idmenuItems_${i}`]) break;
      cartItems.push({
        idmenuItems: body[`idmenuItems_${i}`],
        name: body[`name_${i}`],
        price: parseFloat(body[`price_${i}`]),
        quantity: parseInt(body[`quantity_${i}`], 10)
      });
    }

    if (cartItems.length === 0) {
      return res.status(400).send('Cart is empty or invalid');
    }

    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += item.price * item.quantity;
    });

    const insertOrderSql = 'INSERT INTO orders (iduser, name, total_amount, order_date) VALUES (?, ?, ?, NOW())';
    db.query(insertOrderSql, [req.session.user.id, req.session.user.username, totalAmount,'Processing'], (err, orderResult) => {
      if (err) {
        console.error('Error inserting order:', err);
        return res.status(500).send('Error placing order');
      }
      const orderId = orderResult.insertId;
      const insertItemsSql = 'INSERT INTO orderItems (idorder, idmenuItems, quantity, price) VALUES ?';
      const itemsData = cartItems.map(item => [
        orderId,
        item.idmenuItems,
        item.quantity,
        item.price
      ]);

      db.query(insertItemsSql, [itemsData], (err2) => {
        if (err2) {
          console.error('Error inserting order items:', err2);
          return res.status(500).send('Error saving order items');
        }

        req.session.cart = []; // clear cart
        res.redirect(`/orderConfirmation?idorder=${orderId}`);
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

//Order Confirmation
app.get('/orderConfirmation', async (req, res) => {
  const orderId = req.query.idorder;
  const dbPromise = db.promise();

  try {
    const [orderRows] = await dbPromise.query(
      `SELECT * FROM orders WHERE idorder = ?`,
      [orderId]
    );

    const [itemRows] = await dbPromise.query(
        `SELECT oi.*, m.name AS foodName FROM orderItems oi 
        JOIN menuItems m ON oi.idmenuItems = m.idmenuItems WHERE oi.idorder = ?`,
        [orderId]
    );

    res.render('orderConfirmation', {
      order: orderRows[0],
      items: itemRows,
      user: req.session.user
    });
    } catch (err) {
        console.error('Error loading confirmation:', err);
        res.status(500).send('Unable to load confirmation page');
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
    const orderId = req.query.idorder;

    if (!orderId) {
        req.flash('error', 'Order ID is required.');
        return res.redirect('/menu');
    }

    const sql = 'SELECT total_amount FROM orders WHERE idorder = ?';

    db.query(sql, [orderId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'An error occurred while fetching the order.');
            return res.redirect('/menu');
        }

        if (results.length === 0) {
            req.flash('error', 'Order not found.');
            return res.redirect('/menu');
        }

        const totalAmount = results[0].total_amount;

        res.render('payment', {
            user: req.session.user,
            total: totalAmount,
            orderId: orderId,
            messages: req.flash('error')
        });
    });
});


app.post('/processPayment', checkAuthenticated, (req, res) => {
    const { cardNumber, expiryDate, cvv, idorder } = req.body;

    if (!cardNumber || !expiryDate || !cvv || !idorder) {
        req.flash('error', 'All payment fields are required.');
        return res.redirect(`/payment?idorder=${idorder}`);
    }

    const sql = 'SELECT total_amount FROM orders WHERE idorder = ?';
    db.query(sql, [idorder], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'Failed to fetch total amount.');
            return res.redirect(`/payment?idorder=${idorder}`);
        }

        if (results.length === 0) {
            req.flash('error', 'Order not found.');
            return res.redirect(`/payment?idorder=${idorder}`);
        }

        const totalAmount = results[0].total_amount;
        req.session.cart = [];

        res.render('paymentSuccess', {
            user: req.session.user,
            amount: totalAmount,
            orderId: idorder
        });
    });
    const updateStatusSql = 'UPDATE orders SET status = ? WHERE idorder = ?';
    db.query(updateStatusSql, ['Paid', idorder], (err3) => {
    if (err3) 
        console.error('Error updating order status:', err3);
    });
});

// Starting the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Foodiess is running on http://localhost:${PORT}`);
});
