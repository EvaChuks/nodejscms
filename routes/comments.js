const express = require('express');
var router    = express.Router({mergeParams: true});
var Campground = require('../models/campground');
var Comment    = require('../models/comment');
var campgroundRoutes = require('../routes/campgrounds');
var middleware = require("../middleware");

router.get("/new", middleware.isLoggedIn, function(req, res){
	Campground.findOne({slug:req.params.slug}, function(err, campground){
		if(err || !campground){
			   req.flash('error', 'Campground not found');
			   res.redirect('back');
		}else{
			res.render('comments/new', {campground:campground})
		}
	});
});

router.post('/',middleware.isLoggedIn, function(req, res){
	Campground.findOne({slug:req.params.slug}, function(err, campground){
		if(err || !campground){
			req.flash('error', 'Campground not found');
			res,redirect('/campgrounds');
		}else{
			Comment.create(req.body.comment, function(err, comment){
				if(err || !comment){
			         req.flash('error', 'Comment not found');
					 res.redirect('/campgrounds');
				}else{
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
					comment.save();
					campground.comments.push(comment);
					campground.save();
					 req.flash("success","Successfully Created!");
					res.redirect('/campgrounds/' + campground.slug);
				}
			})
		}
	})
});

router.get('/:comment_id/edit', middleware.checkCommentOwnership, function(req, res){
	Comment.findById(req.params.comment_id, function(err, foundComment){
		if(err || !foundComment){
			   req.flash('error', 'Comment not found');
			   res.redirect('back');
		}else{
			res.render('comments/edit', {campground_slug: req.params.slug, comment:foundComment});
			
		}
	})
	
});
router.put('/:comment_id', middleware.checkCommentOwnership, function(req, res){
	// Comment.findById(req.params.id, function(err, foundCampground){
	// 	if(err || !foundCampground){
	// 		req.flash('error', 'No campground found');
	// 		return res.redirect('back');
	// 	}
		Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment,function(err, updatedComment){
		if(err || !updatedComment){
			   req.flash('error', 'Comment not found');
			   res.redirect('back');
		}else{
			 req.flash("success","Successfully Updated!");
			res.redirect('/campgrounds/'+ req.params.slug);
		}
	});

});
router.delete('/:comment_id', middleware.checkCommentOwnership, function(req, res){
	Comment.findByIdAndRemove(req.params.comment_id, function(err){
		if(err){
			res.redirect('back');
		}else{
			 req.flash("success","Successfully Removed!");
			res.redirect('/campgrounds/' + req.params.slug);
		}
		
	});
});

// ==================
// Middleware
// ==================


module.exports = router;
