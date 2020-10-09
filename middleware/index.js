var Campground = require("../models/campground");
var Comment = require("../models/comment");
var User    = require("../models/user");
var Review = require("../models/review");

// all the middleare goes here
var middlewareObj = {};

middlewareObj.checkCampgroundOwnership = function(req, res, next) {
 if(req.isAuthenticated() ){
        Campground.findOne({slug:req.params.slug}, function(err, foundCampground){
           if(err || !foundCampground){
			   req.flash('error', 'Campground not found');
               res.redirect("back");
           }  else {
               // does user own the campground?
            if(foundCampground.author.id.equals(req.user._id) || req.user.isAdmin) {
                next();
            } else {
				req.flash("error", "You don't permission to do that");
                res.redirect("back");
            }
           }
        });
    } else {
		req.flash('error', 'You need to logged in to do that');
        res.redirect("back");
    }
}

middlewareObj.checkCommentOwnership = function(req, res, next) {
 if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id, function(err, foundComment){
           if(err || !foundComment){
			   req.flash('error', 'Comment not found');
			   
               res.redirect("back");
           }  else {
               // does user own the comment?
            if(foundComment.author.id.equals(req.user._id)|| req.user.isAdmin) {
                next();
            } else {
				req.flash('error', "You don't have permission to do that");
                res.redirect("back");
            }
           }
        });
    } else {
		req.flash('error', 'You need to logged in to do that');
        res.redirect("back");
    }
};
// Review Middleware
middlewareObj.checkReviewOwnership = function(req, res, next) {
    if(req.isAuthenticated()){
        Review.findById(req.params.review_id, function(err, foundReview){
            if(err || !foundReview){
                res.redirect("back");
            }  else {
                // does user own the comment?
                if(foundReview.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistence = function (req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findById(req.params.id).populate("reviews").exec(function (err, foundCampground) {
            if (err || !foundCampground) {
                req.flash("error", "Campground not found.");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundCampground.reviews
                var foundUserReview = foundCampground.reviews.some(function (review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review.");
                    return res.redirect("/campgrounds/" + foundCampground._id);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};

middlewareObj.isLoggedIn = function(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
	req.flash("error", "Please login First!");
    res.redirect("/login");
}
middlewareObj.isNotVerified = async function(req, res, next){
	try{
		const user = await User.findOne({username: req.body.username});
		if(user.isVerified){
			return next();
		}
		req.flash('error', `Your account is not yet verified check your ${user.email} for  verification link`);
		res.redirect('/campgrounds');
	} catch(error){
		console.log(error);
		req.flash('error', 'something went wrong! contact us for assistance');
		res.redirect('/campgrounds');
	}
	
}

module.exports = middlewareObj;