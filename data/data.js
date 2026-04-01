const mongoose = require('mongoose');
const Restaurant = require('../schemas/Restaurant');
const Review = require('../schemas/Review');
const User = require('../schemas/User');
const bcrypt = require('bcrypt');


mongoose.connect('mongodb://localhost:27017/eatstagram')
    .then(() => console.log('Successfully connected to MongoDB'))
    .catch(err => console.error(err));


async function populateDB() {
    // prevent duplicate data
    await Restaurant.deleteMany({});
    await Review.deleteMany({});
    await User.deleteMany({});

    // insert restaurant data
    const Restaurants = await Restaurant.insertMany([
        { name: 'Itallianis', location: 'Manila, Philippines', operatingHrs: '10:00 AM - 9:00 PM', description: 'Italianis is a cozy Italian eatery serving authentic pasta, wood-fired pizzas, and classic Mediterranean flavors in a warm, inviting atmosphere.', image: 'itallianis.webp', rating: 0, featured: false }, 
        { name: 'Barcino', location: 'Muntinlupa, Philippines', operatingHrs: '10:00 AM - 12:00 AM', description: 'Barcino is a modern tapas bar offering a vibrant Spanish dining experience with small plates, flavorful wines, and a lively, social atmosphere.', image: 'barcino.jpg', rating: 0, featured: true },
        { name: 'Gallery By Chele', location: 'Taguig, Philippines', operatingHrs: '6:00 PM - 11:00 PM', description: 'Gallery by Chele is an innovative fine-dining restaurant showcasing contemporary Filipino cuisine with artistic presentations and locally inspired flavors.', image: 'chele.jpg', rating: 0, featured: true }, 
        { name: 'Seascape Village', location: 'Pasay, Philippines', operatingHrs: '9:00 AM - 6:00 PM', description: 'Seascape Village is a serene coastal retreat featuring charming beachfront accommodations, scenic ocean views, and a relaxing, laid-back atmosphere.', image: 'seascapevillage.png', rating: 0, featured: true },
        { name: 'Manam', location: 'Manila, Philippines', operatingHrs: '10:00 AM - 9:00 PM', description: 'Manam is a beloved Filipino restaurant known for its hearty, comfort-style dishes that celebrate traditional and modern local flavors.', image: 'manam.jpg', rating: 0, featured: true }, 
        { name: 'La Creperie', location: 'Quezon, Philippines', operatingHrs: '10:00 AM - 10:00 PM', description: 'La Crêperie is a charming café specializing in sweet and savory French crepes, paired with artisanal coffees and a cozy, inviting ambiance.', image: 'lacreperie.jpg', rating: 0, featured: true },
        { name: 'Crisostomo', location: 'Pasay, Philippines', operatingHrs: '11:00 AM - 9:00 PM', description: 'Crisostomo is a contemporary Filipino restaurant offering flavorful, thoughtfully crafted dishes that blend tradition with modern culinary twists.', image: 'crisostomo.jpg', rating: 0, featured: true }, 
        { name: 'Chili\'s', location: 'Muntinlupa, Philippines', operatingHrs: '10:00 AM - 9:00 PM', description: 'Chili\'s is a casual American grill and bar serving Tex-Mex favorites, burgers, and ribs in a fun, family-friendly atmosphere.', image: 'chilis.jpg', rating: 0, featured: true },
        { name: 'Jin Joo Korean Grill', location: 'Makati, Philippines', operatingHrs: '11:00 AM - 10:00 PM', description: 'Jinjoo Korean Grill is a vibrant Korean BBQ restaurant where diners can grill premium meats at their table and enjoy authentic, flavorful side dishes in a lively setting.', image: 'jinjoo.webp', rating: 0, featured: false }, 
        { name: 'Mary Grace Cafe', location: 'Muntinlupa, Philippines', operatingHrs: '8:00 AM - 10:00 PM', description: 'Mary Grace is a cozy café and bakery known for its homey Filipino comfort food, freshly baked pastries, and warm, inviting atmosphere.', image: 'marygrace.jpg', rating: 0, featured: false }
    ])


    // for users, make insertMany for regular users and admin users (same password for admins)

    const adminUsers = [
        { username: 'jamesAdmin', email: 'james_guinto@dlsu.edu.ph', password: '12409316', isAdmin: true, managedRestaurants: [Restaurants[0]._id]},
        { username: 'bruceWayne', email: 'brucewayne@gmail.com', password: 'imBatman', isAdmin: true, managedRestaurants: [Restaurants[1]._id]}
    ];

    for (let u of adminUsers) {
        const hashed = await bcrypt.hash(u.password, 10);
        u.password = hashed;
    }

    await User.insertMany(adminUsers);

    // for user id, can use _id for mongoDB
    console.log('Data successfully added to database!');
    mongoose.connection.close();
}

populateDB();