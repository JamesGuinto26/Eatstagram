const express = require('express');
const { engine: hbsEngine } = require('express-handlebars');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const fileUpload = require('express-fileupload')
const Restaurant = require('./schemas/Restaurant');

const app = express();

// connect to MongoDB
mongoose.connect('mongodb://localhost:27017/eatstagram')
.then(async () => {
    console.log('Successfully connected to MongoDB');
})
.catch(err => console.error('Error connecting to MongoDB:', err));


app.engine('hbs', hbsEngine( {
    extname: '.hbs', // set .hbs as template file extension
    defaultLayout: 'main', // use as main layout
    layoutsDir: path.join(__dirname, 'views', 'layouts'), // where layouts are stored
    partialsDir: path.join(__dirname, 'views', 'partials'), // where reusable hbs files are stored
    helpers: {
        stars: (rating) => {
            const full = '★'.repeat(Math.floor(rating));
            const empty = '☆'.repeat(5 - Math.floor(rating));
            return full + empty;
        },
        formatDate: (date) => {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        },
        formatTime: (date) => {
            if (!date) return '';
            return new Date(date).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        },
        eq: (a, b) => {
            return String(a) === String(b); // convert to string to avoid ObjectId mismatch
        }
    }
}))

app.set('view engine', 'hbs'); // for rendering
app.set('views', path.join(__dirname, 'views')); // where layouts are located

// Middlewares
app.use(express.static(path.join(__dirname, 'public'))); // for public folder access (css, js)
app.use(express.urlencoded({ extended: true })); // for reading html forms
app.use(express.json());

app.use(session({
    secret: 'eatstagram-key',
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    res.locals.isLoggedIn = req.session.user ? true : false;
    res.locals.currentUser = req.session.user || null; // includes name, image, role
    next();
});

app.use((req, res, next) => {
    res.locals.currentUserId = req.session.userId || null;
    res.locals.currentUserName = req.session.userName || null;
    res.locals.isUserAdmin = req.session.isAdmin || false;
    res.locals.isUserLoggedIn = !!req.session.userId;
    next();
});

// for file uploads
app.use(fileUpload());

// Set up routes
app.use('/', require('./routes/home')); 
app.use('/restaurants', require('./routes/restaurants'));
app.use('/users', require('./routes/users'));
app.use('/reviews', require('./routes/reviews'));

// Error handling
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        establishments: [],
        reviews: [],
        error: 'Page not found'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500', {  
        title: 'Server Error',
        message: 'Something went wrong on our side. Please try again later.',
        error: err.message
    });
});


// create and start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}`);
}); 

