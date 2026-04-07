const express = require('express');
const router = express.Router();
const Review = require('../schemas/Review');
const Restaurant = require('../schemas/Restaurant');
const Comment = require('../schemas/Comment');
const mongoose = require('mongoose');
const User = require('../schemas/User');
const path = require('path');
const fs = require('fs');


router.get('/:id/comments', async (req, res) => {
    
    const reviewId = req.params.id;
    const review = await Review.findById(reviewId).populate('userId', 'username image').lean();

    const restaurant = await Restaurant.findById(review.restaurantId).lean();

    const comments = await Comment.find({ reviewId }).populate('userId', 'username image').lean();

   let isManager = false;

    if (req.session.userId) {
        const User = require('../schemas/User'); 

        const user = await User.findById(req.session.userId).lean();

        if (user && user.managedRestaurants) {
            isManager = user.managedRestaurants
                .some(r => String(r) === String(restaurant._id));
        }
    }

    res.render('reviewSelect', {
        review,
        comments,
        isManager,
        extraCSS: 'reviewSelect.css',
        currentUserId: req.session.userId,
        navbarUser: req.session.user
    });
});

// going to add review form
router.get('/add/:restaurantId', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    const restaurant = await Restaurant.findById(req.params.restaurantId).lean();

    if (!restaurant) {
        return res.redirect('/');
    }

    res.render('add-review', {
        title: 'Add Review',
        restaurant,
        extraCSS: 'add-review.css',
        navbarUser: req.session.user
    });
});

// for posting reviews
router.post('/add/:restaurantId', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    try {
        const { title, rating, comment } = req.body;

        let errors = [];

        if (!title || title.trim() === "") {
            errors.push("Title cannot be blank.");
        }

        if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
            errors.push("Please select a valid star rating.");
        }

        if (errors.length > 0) {
            // Optional: you can pass errors to template
            return res.render('add-review', {
                restaurant: await Restaurant.findById(req.params.restaurantId).lean(),
                errors,
                title,
                rating,
                comment
            });
        }

        let mediaArray = [];

        if (req.files && req.files.media) {
            let files = req.files.media;

            if (!Array.isArray(files)) files = [files];

            if (files.length > 3) {
                errors.push("Maximum of 3 media files allowed.");
                return res.render('add-review', {
                    restaurant: await Restaurant.findById(req.params.restaurantId).lean(),
                    errors,
                    title,
                    rating,
                    comment
                });
            }

            for (let file of files) {
                // Determine type
                let mediaType = file.mimetype.startsWith('image') ? 'image' : 'video';

                const fileName = Date.now() + '-' + file.name;
                const uploadPath = path.join(__dirname, '../public/uploads', fileName);

                if (!fs.existsSync(path.join(__dirname, '../public/uploads'))) {
                    fs.mkdirSync(path.join(__dirname, '../public/uploads'));
                }

                await file.mv(uploadPath);

                mediaArray.push({
                    url: '/uploads/' + fileName,
                    mediaType
                });
            }
        }

        const newReview = await Review.create({
            title: title.trim(),
            rating: Number(rating),
            comment: comment ? comment.trim() : "",
            userId: req.session.userId,
            restaurantId: req.params.restaurantId,
            media: mediaArray
        });

        const reviews = await Review.find({
            restaurantId: req.params.restaurantId
        });

        let total = 0;

        for (let r of reviews) {
            total += r.rating;
        }

        const average = reviews.length > 0
            ? total / reviews.length
            : 0;

        const roundedAverage = Math.round(average * 10) / 10;

        await Restaurant.findByIdAndUpdate(
            req.params.restaurantId,
            { rating: roundedAverage }
        );

        console.log(`Review submitted successfully! ID: ${newReview._id}, Title: "${newReview.title}", Restaurant: ${req.params.restaurantId}`);

        res.redirect('/restaurants/' + req.params.restaurantId);

    } catch (err) {
        console.error(err);
        res.redirect('/reviews/add/' + req.params.restaurantId);
    }
});

// route for edit review
router.get('/edit/:reviewId', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    try {
        const review = await Review.findById(req.params.reviewId).lean();

        if (!review) {
            return res.redirect('/');
        }

        if (String(review.userId) !== String(req.session.userId)) {
            return res.redirect('/restaurants/' + review.restaurantId);
        }

        const restaurant = await Restaurant.findById(review.restaurantId).lean();

        res.render('edit-review', {
            title: 'Edit Review',
            review,
            restaurant,
            from: req.query.from, 
            extraCSS: 'add-review.css',
            navbarUser: req.session.user
        });

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// for submitting edited review
router.post('/edit/:reviewId', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    try {
        const from = req.body.from; 

        const { title, rating, comment } = req.body;

        const review = await Review.findById(req.params.reviewId);

        if (!review) return res.redirect('/');

        // Only owner can edit
        if (String(review.userId) !== String(req.session.userId)) {
            return res.redirect('/restaurants/' + review.restaurantId);
        }

        let errors = [];

        if (!title || title.trim() === "") {
            errors.push("Title cannot be blank.");
        }

        if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
            errors.push("Invalid rating.");
        }

        let newFiles = [];

        if (req.files && req.files.media) {
            let files = req.files.media;
            if (!Array.isArray(files)) files = [files];
            newFiles = files;
        }

        if (newFiles.length > 3) {
            errors.push("Maximum of 3 media files allowed.");
        }

        if (errors.length > 0) {
            return res.render('edit-review', {
                review: review.toObject(),
                restaurant: await Restaurant.findById(review.restaurantId).lean(),
                errors,
                extraCSS: 'add-review.css'
            });
        }

        for (let m of review.media) {
            const filePath = path.join(__dirname, '../public', m.url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // reset media
        review.media = [];

        // saving new uploaded media
        const uploadDir = path.join(__dirname, '../public/uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }

        for (let file of newFiles) {

            let mediaType = file.mimetype.startsWith('image')
                ? 'image'
                : 'video';

            const fileName = Date.now() + '-' + file.name;
            const uploadPath = path.join(uploadDir, fileName);

            await file.mv(uploadPath);

            review.media.push({
                url: '/uploads/' + fileName,
                mediaType
            });
        }

        // updating text fields
        review.title = title.trim();
        review.rating = Number(rating);
        review.comment = comment ? comment.trim() : "";
        review.editedAt = new Date(); 

        await review.save();

        // recalculate restaurant ratings
        const reviews = await Review.find({
            restaurantId: review.restaurantId
        });

        let total = 0;
        for (let r of reviews) {
            total += r.rating;
        }

        const average = reviews.length > 0
            ? total / reviews.length
            : 0;

        const roundedAverage = Math.round(average * 10) / 10;

        await Restaurant.findByIdAndUpdate(
            review.restaurantId,
            { rating: roundedAverage }
        );

        if (from === "my") {
            return res.redirect('/reviews/my');
        }

        res.redirect('/restaurants/' + review.restaurantId);

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// deleting a review
router.get('/delete/:reviewId', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    try {
        const from = req.query.from;

        const review = await Review.findById(req.params.reviewId);

        if (!review) {
            return res.redirect('/');
        }

        if (String(review.userId) !== String(req.session.userId)) {
            return res.redirect('/restaurants/' + review.restaurantId);
        }

        for (let m of review.media) {
            const filePath = path.join(__dirname, '../public', m.url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        const restaurantId = review.restaurantId;

        // delete comments related to review
        await Comment.deleteMany({ reviewId: req.params.reviewId });

        // delete from DB
        await Review.findByIdAndDelete(req.params.reviewId)

        const reviews = await Review.find({ restaurantId });

        let total = 0;
        for (let r of reviews) {
            total += r.rating;
        }

        const average = reviews.length > 0 ? total / reviews.length : 0;
        const roundedAverage = Math.round(average * 10)/10;

        // update restaurant ratings after review deletion
        await Restaurant.findByIdAndUpdate(restaurantId, { rating: roundedAverage });

        console.log(`Review ${req.params.reviewId} deleted successfully.`);

        if (from === "my") {
            return res.redirect('/reviews/my');
        }

        res.redirect('/restaurants/' + restaurantId);
    
    } catch (err) {
        console.error(err);
        res.redirect('/');
    } 
});

// for adding comments
router.post('/:id/comments', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    try {
        const reviewId = req.params.id;
        const { comment } = req.body;

        if (!comment || comment.trim() === "") {
            return res.redirect('/reviews/' + reviewId + '/comments');
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.redirect('/');
        }

        await Comment.create({
            reviewId: reviewId,
            userId: req.session.userId,
            text: comment.trim()
        });

        console.log("Comment added successfully.");

        res.redirect('/reviews/' + reviewId + '/comments');

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// route for search reviews page
router.get('/search-reviews', async (req, res) => {
    try {
        const query = req.query.query || "";
        const currentUserId = req.session.userId;

        let reviews = [];

        if (query === "") {
            reviews = await Review.find({}).populate('userId', 'username image').populate('restaurantId', 'name').lean();
        } else {
            reviews = await Review.find({
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { comment: { $regex: query, $options: 'i' } }
                ]
            })
            .populate('userId', 'username image')
            .populate('restaurantId', 'name')
            .lean();
        }

        for (let review of reviews) {
            review.isHelpful = review.helpfulUsers?.some(
                u => String(u) === String(currentUserId)
            );

            review.isUnhelpful = review.unhelpfulUsers?.some(
                u => String(u) === String(currentUserId)
            );
        }

        res.render('search-reviews', {
            title: 'Search Reviews',
            reviews,
            query,
            extraCSS: 'search-reviews.css',
            navbarUser: req.session.user,
            currentUserId: currentUserId
        });

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// mark helpful route
router.post('/:id/helpful', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    const from = req.query.from;

    const review = await Review.findById(req.params.id);

    if (!review) return res.redirect('/');

    const userId = req.session.userId;

    const alreadyHelpful = review.helpfulUsers.includes(userId);
    const alreadyUnhelpful = review.unhelpfulUsers.includes(userId);

    if (alreadyHelpful) { // toggle off
        review.helpfulUsers.pull(userId);
        review.helpfulCount--;
    } else {
        review.helpfulUsers.push(userId); //mark helpful
        review.helpfulCount++;

        if (alreadyUnhelpful) { // undo mark unhelpful
            review.unhelpfulUsers.pull(userId);
            review.unhelpfulCount--;
        }
    }

    await review.save();

    if (from === "my") {
        return res.redirect('/reviews/my');
    }

    if (from === "search") {
        return res.redirect('/reviews/search-reviews');
    }

    res.redirect('/restaurants/' + review.restaurantId + '#review-' + review._id);
});

// mark unhelpful route
router.post('/:id/unhelpful', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }

    const from = req.query.from;

    const review = await Review.findById(req.params.id);

    if (!review) return res.redirect('/');

    const userId = req.session.userId;

    const alreadyUnhelpful = review.unhelpfulUsers.includes(userId);
    const alreadyHelpful = review.helpfulUsers.includes(userId);

    if (alreadyUnhelpful) { // toggle off
        review.unhelpfulUsers.pull(userId);
        review.unhelpfulCount--;
    } else {
        review.unhelpfulUsers.push(userId);
        review.unhelpfulCount++;

        if (alreadyHelpful) { // undo mark helpful
            review.helpfulUsers.pull(userId);
            review.helpfulCount--;
        }
    }

    await review.save();

    if (from === "my") {
        return res.redirect('/reviews/my');
    }

    if (from === "search") {
        return res.redirect('/reviews/search-reviews');
    }

    res.redirect('/restaurants/' + review.restaurantId + '#review-' + review._id);
});

// for my reviews page route
router.get('/my', async (req, res) => {
    try {
        const reviews = await Review.find({ userId: req.session.userId}).populate('restaurantId').populate('userId').sort({ reviewDate: -1 }).lean();

        const currentUserId = req.session.userId;

        for (let review of reviews) {
            review.isHelpful = review.helpfulUsers?.some(
                u => String(u) === String(currentUserId)
            );

            review.isUnhelpful = review.unhelpfulUsers?.some(
                u => String(u) === String(currentUserId)
            );
        }

        res.render('myReviews', {
            title: "My Reviews",
            reviews,
            currentUserId: req.session.userId,
            extraCSS: "myReviews.css",
            navbarUser: req.session.user 
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// for check reviews of other users
router.get('/user/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        const reviews = await Review.find({ userId })
            .populate('restaurantId')
            .populate('userId')
            .sort({ reviewDate: -1 })
            .lean();

        res.render('myReviews', {  
            title: "User Reviews",
            reviews,
            currentUserId: req.session.userId,
            extraCSS: "myReviews.css",
            navbarUser: req.session.user
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
