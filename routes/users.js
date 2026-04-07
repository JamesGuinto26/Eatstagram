const express = require('express');
const router = express.Router();
const User = require('../schemas/User'); 
const Review = require('../schemas/Review');
const bcrypt = require('bcrypt');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');

// for login route
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/'); 
    }

    res.render('login', {
        title: 'Log In',
        extraCSS: 'login.css' 
    });
});

// for login logic
router.post('/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;

        const user = await User.findOne({ username });
        
    
        if (!user) {
            return res.render('login', {
                title: 'Log In',
                extraCSS: 'login.css',
                error: 'Invalid username or password',
                username 
            });
        }

        const matchPW = await bcrypt.compare(password, user.password);
        if (!matchPW) {
            return res.render('login', {
                title: 'Log In',
                extraCSS: 'login.css',
                error: 'Invalid username or password',
                username 
            });
        }

        if (rememberMe) {
            req.session.cookie.maxAge = 21 * 24 * 60 * 60 * 1000;
        } else {
            req.session.cookie.expires = false;
        }

        req.session.userId = user._id;
        req.session.userName = user.username;
        req.session.isAdmin = user.isAdmin;
        req.session.user = user;

        res.redirect('/');

    } catch (err) {
        console.error(err);
        res.render('login', {
            error: 'Something went wrong with login'
        })
    }
})

// helper for email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// for signup route
router.get('/signup', (req, res) => {
    res.render('signup', {
        title: 'Sign Up',
        extraCSS: 'signup.css'
    });
});

// for signup logic
router.post('/signup', async (req, res) => {
    try {
        const { username, email, phoneNum, password, confirmPassword, description } = req.body;
        let avatarPicture = req.files?.avatar;
        let avatarDefault = '/images/profile.png';

        if (password !== confirmPassword) {
            return res.render('signup', {
                error: 'Passwords do not match', title: 'Sign Up'
            });
        }

        if (!isValidEmail(email)) {
            return res.render('signup', { error: 'Please enter a valid email address', title: 'Sign Up' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('signup', {
                error: 'Email already registered', title: 'Sign Up'
            });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.render('signup', { 
                error: 'Username already taken', title: 'Sign Up' 
            });
        }

        /*
        if (avatarPicture) {
            const uploadPath = `/public/uploads/${Date.now()}_${avatarPicture.name}`;
            avatarDefault = `/uploads/${Date.now()}_${avatarPicture.name}`;
            await avatarPicture.mv('.' + uploadPath);
        }
        */
        if (avatarPicture) {
            const uploadDir = path.join(__dirname, '../public/uploads');

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const fileName = `${Date.now()}_${avatarPicture.name}`;
            const uploadPath = path.join(uploadDir, fileName);

            await avatarPicture.mv(uploadPath);

            avatarDefault = `/uploads/${fileName}`;
        }

        if (!req.body.terms) {
            return res.render('signup', { 
                error: 'You must agree to the Terms of Service and Privacy Policy', title: 'Sign Up' 
            });
        }

        const hashedPW = await bcrypt.hash(password, 10); // hash password before storing in DB

        const newUser = new User ({
            username, 
            email,
            phoneNum: phoneNum || '',
            password: hashedPW,
            image: avatarDefault,
            description: description || '' 
        });

        await newUser.save();

        req.session.userId = newUser._id;
        req.session.userName = newUser.username;
        req.session.isAdmin = newUser.isAdmin;
        req.session.user = newUser;

        res.redirect('/');

    } catch (err) {
        console.error(err);
        res.render('signup', {
            error: 'Something went wrong. Please try again.'
        })
    }
});

// for viewing user profile (own profile)
router.get('/profile', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/users/login');
        }

        const user = await User.findById(req.session.userId).populate('managedRestaurants', 'name').lean();

        if (user.isAdmin && user.managedRestaurants.length > 0) {
            user.managedRestaurantName = user.managedRestaurants[0].name;
        }

        const userReviews = await Review.find({ userId: req.session.userId }).sort({ reviewDate: -1 }).limit(2).populate('restaurantId', 'name').lean();

        let userComments = [];

        if (user.isAdmin) {
            const Comment = require('../schemas/Comment');
            userComments = await Comment.find({ userId: req.session.userId }).sort({ commentDate: -1 }).limit(4).lean();
        }

        res.render('profilePage', {
            title: 'My Profile',
            currentUser: user,
            userReviews,
            userComments,     // <-- you forgot this
            isLoggedIn: true,
            isUserAdmin: user.isAdmin,
            extraCSS: 'profilePage.css',
            showEdit: true,
            viewingOther: false,
            navbarUser: req.session.user
        });

    } catch (err) {
        console.error('PROFILE ROUTE ERROR:', err);
        res.status(500).send('Server error');
    }
});

// viewing another user's profile
router.get('/profile/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/users/login');
        }

        const otherUser = await User.findById(req.params.id).populate('managedRestaurants', 'name').lean();

        if (!otherUser) return res.redirect('/');

        if (otherUser.isAdmin && otherUser.managedRestaurants.length > 0) {
            otherUser.managedRestaurantName = otherUser.managedRestaurants[0].name;
        }

        const userReviews = await Review.find({ userId: otherUser._id })
            .sort({ createdAt: -1 })
            .limit(2)
            .populate('restaurantId', 'name')
            .lean();

        res.render('profilePage', {
            title: `${otherUser.username}'s Profile`,
            currentUser: otherUser,
            userReviews,
            isLoggedIn: true,
            isUserAdmin: req.session.isAdmin,
            extraCSS: 'profilePage.css',
            showEdit: false,     
            viewingOther: true,    
            navbarUser: req.session.user
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// route for editing profile
router.get('/edit-profile', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    const currentUser = await User.findById(req.session.userId).lean();

    res.render('editProfile', {
        title: 'Edit Profile',       
        isLoggedIn: true,            
        extraCSS: 'editProfile.css', 
        currentUser,
        navbarUser: req.session.user                
    });
});

// for editing profile logic
router.post('/edit-profile', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/users/login');
        }

        const { username, email, phoneNum, description } = req.body;
        let avatarPicture = req.files?.avatar;

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/users/login');
        }

        if (!isValidEmail(email)) {
            return res.render ('editProfile', {
                error: 'Please enter a valid email address',
                currentUser: user,
                extraCSS: 'editProfile.css'
            });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername && existingUsername._id.toString() !== user._id.toString()) {
            return res.render('editProfile', {
                error: 'Username already taken',
                currentUser: user,
                extraCSS: 'editProfile.css'
            });
        }

        const existingEmail = await User.findOne({ email });
        if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
            return res.render('editProfile', {
                error: 'Email already registered',
                currentUser: user,
                extraCSS: 'editProfile.css'
            });
        }

        if (avatarPicture) {
            const fileName = `${Date.now()}_${avatarPicture.name}`;
            const uploadPath = `/public/uploads/${fileName}`;

            await avatarPicture.mv('.' + uploadPath);

            user.image = `/uploads/${fileName}`;
        }

        user.username = username;
        user.email = email;
        user.phoneNum = phoneNum || '';
        user.description = description || '';

        await user.save();

        req.session.userName = user.username;
        req.session.user = user;

        res.redirect('/users/profile');

    } catch (err) {
        console.error(err);
        console.error("EDIT PROFILE ERROR:", err);
        res.render('editProfile', {
            error: 'Something went wrong while updating profile.',
            extraCSS: 'editProfile.css'
        });
    }
})

// for logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.redirect('/');
        }

        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});


module.exports = router;
