const express      = require('express');
var router         = express.Router();
var passport       = require('passport');
var User           = require('../models/user');
const { isLoggedIn, isNotVerified } = require('../middleware');
var Notification = require("../models/notification");
var Campground     = require('../models/campground');  
var nodemailer     = require('nodemailer');
var async		   = require('async');
var crypto         = require('crypto');
// ======================
// require sendgrid/mail
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// sgMail ends here

// ===================
// cloudinary
// ===================

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


// Landing Page
router.get("/", function(req, res){
	res.render("landing");
});

// show register form
router.get("/register", function(req, res){
   res.render("register", {page: 'register'}); 
});

// Register Logic
router.post('/register', upload.single('image'), function(req, res){
	var username = req.body.username;
	var firstName = req.body.firstName;
	var lastName = req.body.lastName;
	var email = req.body.email;
	var emailToken = crypto.randomBytes(64).toString('hex');
	var isVerified = false;
	var image = req.body.image;
	var imageId = req.body.imageId;
	cloudinary.v2.uploader.upload(req.file.path, async function(err, result) {
			image = result.secure_url;
            imageId= result.public_id;
	var newUser = new User({
		username: username,
		firstName: firstName,
		lastName: lastName,
		email: email,
		emailToken: emailToken,
		isVerified:isVerified,
		image: image,
		imageId: imageId
	});
	if(req.body.admincode === 'Secret@123'){
		newUser.isAdmin = true;
	}
	User.register(newUser, req.body.password, async function(err, user){
		if(err){
			console.log(err);
			req.flash('error', 'User with the given username and email already exit');
			return res.render('register', {error: err.message});
		}
		const msg = {
			from:'codewithchuks@gmail.com',
			to: user.email,
			subject: 'Yelpcamp verification mail',
			text: `
Hello, thanks for registering on our site, click copy and paste the below url to verify your account http://${req.headers.host}/verify-email/?token=${user.emailToken}`,
			html: `
<h1>Hello,</h1><p>thanks for registering on our site</p><p>click copy and paste the below url to verify your account.</p><a href="http://${req.headers.host}/verify-email/?token=${user.emailToken}">Verify your account</a>`
		// http://' + req.headers.host + '/reset/' + token + 	  
		};
		try {
    await sgMail.send(msg);
    req.flash('success', 'Thank you for registering, check your email for verification link');
    res.redirect('/');
  } catch (error) {
    console.error(error);
    if (error.response) {
      console.error(error.response.body)
    }
    req.flash('error', 'Sorry, something went wrong, please contact admin@website.com');
    res.redirect('back');
  }
	});
	});

});
// verify-email Route
router.get('/verify-email', async(req, res, next)=>{
	try{
		const user = await User.findOne({emailToken:req.query.token});
		if(!user){
			req.flash('error', 'Invalid Token, contact us for assistance');
			return res.redirect('/contact');
		}
		user.emailToken = null;
		user.isVerified = true;
		await user.save();
		await req.login(user, async(err)=>{
			if(err) return next(err);
			req.flash('success', `Welcome to Yelpcamp ${user.username}`);
			const redirectUrl = req.session.redirectTo || '/';
			delete req.session.redirectTo;
			res.redirect(redirectUrl);
		});
	}catch(error){
		console.log(error);
		req.flash('error', 'Invalid Token, contact us for assistance');
		res.redirect('/');
		
	}
})

// // Login Routes
// router.get('/login', function(req,res){
// 	res.render('login', {message: req.flash('error')});
// });
//show login form
router.get("/login", function(req, res){
   res.render("login", {page: 'login'}); 
});
// Login Logic
router.post('/login', isNotVerified, passport.authenticate('local',{
	successRedirect: '/campgrounds',
	failureRedirect: '/login'
}), function(req, res){
});

router.get('/logout', function(req, res){
	req.logout();
	req.flash('success', 'logged you out')
	res.redirect('/campgrounds');
});

// FORGOT PASSWORD
router.get('/forgot', function(req, res){
	res.render('user/forgot');
});
// forgot password logic
router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 1800000; // 1/2 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'codewithchuks@gmail.com',
          pass: process.env.GMAILPW
        }
      });
  var mailOptions = {
        to: user.email,
        from: 'codewithchuks@gmail.com',
        subject: 'Blog Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log('mail sent');
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});
// Reset Password
router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('user/reset', {token: req.params.token});
  });
});
// Reset Password Logic
router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'codewithchuks@gmail.com',
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'learntocodeinfo@mail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/campgrounds');
  });
});
// USER PROFILE
router.get('/users/:id', async function(req, res){
	try{
		let user = await User.findById(req.params.id).populate('followers').exec();
    res.render('user/profile', { user });
  } catch(err) {
    req.flash('error', err.message);
    return res.redirect('back');
  }
		
	
	// User.findById(req.params.id, function(err, foundUser){
	// 	if(err){
	// 		req.flash("error", "Something went wrong");
	// 		return res.redirect('/')
	// 	}
		Campground.find().where('author.id').equals(user._id).exec(function(err, campgrounds){
			if(err){
			req.flash("error", "Something went wrong");
			return res.redirect('/')
		}
		res.render('user/show', {user:user, campgrounds:campgrounds});	
		})
});

// follow user
router.get('/follow/:id', isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// view all notifications
router.get('/notifications', isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } }
    }).exec();
    let allNotifications = user.notifications;
    res.render('notifications/index', { allNotifications });
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// handle notification
router.get('/notifications/:id', isLoggedIn, async function(req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(`/campgrounds/${notification.campgroundId}`);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});
// CONTACT US ROUTES
router.get('/contact',isLoggedIn, function(req, res){
	res.render('user/contact')
});
// POST /contact
router.post('/contact', async (req, res) => {
  let { name, email, message, subject } = req.body;
  name = req.sanitize(name);
  email = req.sanitize(email);
  message = req.sanitize(message);
	subject = req.sanitize(message);
  const msg = {
    to: 'walter4chuks@gmail.com',
    from: 'codewithchuks@gmail.com',
    subject: subject,
    text: message,
    html: `
    <h1>Hi there, this email is from, ${name}</h1>
    <p>${message}</p>
    `,
  };
  try {
    await sgMail.send(msg);
    req.flash('success', 'Thank you for your email, we will get back to you shortly.');
    res.redirect('/contact');
  } catch (error) {
    console.error(error);
    if (error.response) {
      console.error(error.response.body)
    }
    req.flash('error', 'Sorry, something went wrong, please contact admin@website.com');
    res.redirect('back');
  }
});



module.exports = router;
