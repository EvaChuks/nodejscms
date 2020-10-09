const express      = require('express');
var router         = express.Router();
var Campground     = require('../models/campground');
var Notification   = require("../models/notification")
var middleware     = require("../middleware");
var NodeGeocoder   = require('node-geocoder');
var async		   = require('async');
var User           = require('../models/user');
var Review         = require("../models/review");
var Comment        = require("../models/comment");

// cloudinary
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'ihezurumba', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// GOOGLE MAP
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);

//INDEX - show all campgrounds
router.get("/", function(req, res){
	var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
	var noMatch = null;
    if(req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        // Get all campgrounds from DB
        Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
			Campground.count({name: regex}).exec(function (err, count) {
				if (err) {
                    console.log(err);
                    res.redirect("back");
                } else {
                    if(allCampgrounds.length < 1) {
                        noMatch = "No campgrounds match that query, please try again.";
                    }
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: req.query.search
                    });
                }
            });
        });
        //    if(err){
        //        console.log(err);
        //    } else {
        //       if(allCampgrounds.length < 1) {
        //           noMatch = "No campgrounds match that query, please try again.";
        //       }
        //       res.render("campgrounds/index",{campgrounds:allCampgrounds, noMatch: noMatch});
        //    }
        // });
    } else {
        // get all campgrounds from DB
        Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count().exec(function (err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: false
                    });
                }
            });
        });
    }
});
// New Route for Form
router.get("/new",  middleware.isLoggedIn, function(req, res){
	res.render("campgrounds/new");
});

//Create Route 
router.post("/",  middleware.isLoggedIn, upload.single('image'),  function(req, res){
// 	 local Variables
	var name          = req.body.name;
	var image         = req.body.image;
	var imageId       = req.body.imageId;
	var price         = req.body.price;
	var description   = req.body.description;
	var author        = {id: req.user._id, username: req.user.username
	 };
	
	
	 geocoder.geocode(req.body.location, function (err, data) {
		
			 
    if (err || data.status === 'ZERO_RESULTS') {
		req.flash('error', 'Invalid address, try typing a new address');
      return res.redirect('back');	
    }
		  //Error handling provided by google docs -https://developers.google.com/places/web-service/autocomplete 
    if (err || data.status === 'REQUEST_DENIED') {
            req.flash('error', 'Something Is Wrong Your Request Was Denied');
		  }

 // Error handling provided by google docs -https://developers.google.com/places/web-service/autocomplete 
    if (err || data.status === 'OVER_QUERY_LIMIT') {
            req.flash('error', 'All Requests Used Up');
            return res.redirect('back');
        }
            
	var lat = data[0].latitude;
    var lng = data[0].longitude;
    var location = data[0].formattedAddress;
	cloudinary.v2.uploader.upload(req.file.path, async function(err, result) {
			image = result.secure_url;
            imageId= result.public_id;
			var newCampground = {
				name:name,
				price:price,
				image:image,
				imageId:imageId,
				description: description, 
				author:author,
				location: location,
				lat: lat, 
				lng: lng
			};
		try {
      let campground = await Campground.create(newCampground);
      let user = await User.findById(req.user._id).populate('followers').exec();
      let newNotification = {
        username: req.user.username,
        campgroundId: campground.slug
      }
      for(const follower of user.followers) {
        let notification = await Notification.create(newNotification);
        follower.notifications.push(notification);
        follower.save();
      }

      //redirect back to campgrounds page
      res.redirect(`/campgrounds/${campground.slug}`);
    } catch(err) {
      req.flash('error', err.message);
      res.redirect('back');
    }
	});
	});
	
});
// Show Route
router.get("/:slug", function(req, res){
	Campground.findOne({slug:req.params.slug}).populate('comments').populate({
        path: "reviews",
        options: {sort: {createdAt: -1}}}).populate("comments likes").exec( function(err, foundcamps){
		if(err || !foundcamps){
			   req.flash('error', 'Campground not found');
			   res.redirect('back');
		}else{
			console.log(foundcamps);
			res.render("campgrounds/show", {campground:foundcamps});
			
		}
	})
	
});

// Campground Like Routes
router.post("/:slug/like", middleware.isLoggedIn, function (req, res) {
    Campground.findOne({slug:req.params.slug}, function (err, foundCampground) {
        if (err) {
            console.log(err);
            return res.redirect("/campgrounds");
        }

        // check if req.user._id exists in foundCampground.likes
        var foundUserLike = foundCampground.likes.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundCampground.likes.pull(req.user._id);
        } else {
            // adding the new user like
            foundCampground.likes.push(req.user);
        }

        foundCampground.save(function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/campgrounds");
            }
            return res.redirect("/campgrounds/" + foundCampground.slug);
        });
    });
});

// Edit Route
router.get('/:slug/edit', middleware.checkCampgroundOwnership, function(req, res){
	Campground.findOne({slug:req.params.slug}, function(err, foundCampground){
		if(err){
			res.redirect('/campgrounds')
		}else{
			res.render('campgrounds/edit', {campground:foundCampground});
			
		}
	})
	
});
// UPDATE Route
router.put('/:slug', middleware.checkCampgroundOwnership,upload.single("image"), function(req, res){
	Campground.findOne({slug:req.params.slug}, async function(err, campground){
		
		delete req.body.campground.rating;
	if(err){
		req.flash('error', err.message);
		res.redirect('back');
	}else{
		if(req.file){
			try{
				await cloudinary.v2.uploader.destroy(campground.imageId);
				let result = await cloudinary.v2.uploader.upload(req.file.path);
				campground.imageId = result.public_id;
				campground.image   = result.secure_url;
			}catch(err){
				req.flash('error', err.message);
				res.redirect('back');
				
			}
		 }
	
		if(req.body.location !== campground.location){
			try{
				let data = await geocoder.geocode(req.body.location);
				 campground.lat = data[0].latitude;
				 campground.lng = data[0].longitude;
				 campground.location = data[0].formattedAddress;
			}catch(err){
				req.flash('error', err.message);
				res.redirect('back');
			}
		}
		
		campground.name        = req.body.campground.name;
		campground.price       = req.body.campground.price;
		campground.description = req.body.campground.description;
		campground.save();
		console.log(campground);
		req.flash('success', 'successfully updated');
		res.redirect('/campgrounds');
			
	
	};
		
	});
});
	
	

	
	

// Delete Route
router.delete('/:slug', middleware.checkCampgroundOwnership, function(req, res) {
  Campground.findOne({slug:req.params.slug}, async function(err, campground) {
    if(err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    try {
        await cloudinary.v2.uploader.destroy(campground.imageId);
		await  Comment.remove({"_id": {$in: campground.comments}});
		await Review.remove({"_id": {$in: campground.reviews}});
        campground.remove();
        req.flash('success', 'Campground deleted successfully!');
        res.redirect('/campgrounds');
    } catch(err) {
        if(err) {
          req.flash("error", err.message);
          return res.redirect("back");
        }
    }
  });
})
// router.delete('/:id', middleware.checkCampgroundOwnership, function(req, res){
// 	Campground.findByIdAndRemove(req.params.id, function(err){
// 		if(err){
// 			console.log(err);
// 			res.redirect('/campgrounds');
// 		}else{
// 			 req.flash("success","Successfully Removed!");
// 			res.redirect('/campgrounds');
// 		}
// 	})
// })

// For Search
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};


module.exports = router;