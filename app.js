require('dotenv').config();
const expressSanitizer = require('express-sanitizer');
const bodyParser             = require('body-parser'),
	  // json                   = require('json'),
      express                = require('express'),
      app                    = express(),
      mongoose               = require('mongoose'),
	  flash                  = require('connect-flash'),
	  methodOverride         = require('method-override'),
	  passport               = require('passport'),
	  LocalStrategy          = require('passport-local'),
	  passportLocalMongoose  = require('passport-local-mongoose'),
      Campground             = require('./models/campground'),
	  Comment                = require('./models/comment'),
	  User                   = require('./models/user'),
	  Review                 = require('./models/review'),
      seedDB                 = require('./seed');

var  commentRoutes    = require('./routes/comments'),
	reviewRoutes     = require('./routes/reviews'),
	 campgroundRoutes = require('./routes/campgrounds'),
	 indexRoutes      = require('./routes/index');



mongoose.connect('mongodb://localhost:27017/camp_app_v2', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
})
.then(() => console.log('Connected to DB!'))
.catch(error => console.log(error.message));


//== App Set Config ====
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));
// app.use(express.json());
app.use(expressSanitizer());
app.use(express.static(__dirname + "/public"));
app.use(methodOverride('_method'));
app.use(flash());
app.locals.moment = require('moment');
//seedDB();


// ===============================
// PassPort Config
// =================
app.use(require('express-session')({
	secret: 'The Almighty God is my God',
	resave: false,
	saveUninitialized: false
	
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async function(req, res, next){
   res.locals.currentUser = req.user;
   if(req.user) {
    try {
      let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
      res.locals.notifications = user.notifications.reverse();
    } catch(err) {
      console.log(err.message);
    }
   }
   res.locals.error = req.flash("error");
   res.locals.success = req.flash("success");
   next();
});

// app.use(function(req, res, next){
// 	res.locals.currentUser = req.user;
// 	res.locals.error = req.flash("error");
// 	res.locals.success = req.flash("success");
// 	next();
	
// });

// =======================================
// ROUTES
// ==================

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:slug/comments", commentRoutes);
app.use("/campgrounds/:id/reviews", reviewRoutes);


app.listen(3000, function() { 
  console.log('Yelpcamp has started!!!'); 
});