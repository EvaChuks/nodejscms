const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/cat_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to DB!'))
.catch(error => console.log(error.message));

const catSchema = new mongoose.Schema({
	name: String,
	age: Number,
	character: String
});

const Cat = mongoose.model("Cat", catSchema);

Cat.create({
	name: "Bonny",
	age: 12,
	character: "sasiy"
}, function(err, pussy){
	if(err){
		console.log("something isn't right");
		console.log(err);
	}else{
		console.log("new pussy in town");
		console.log(pussy);
	}
});
Cat.find({}, function(err, cats){
	if(err){
		console.log("cats not found");
		console.log(err);
	}else{
		console.log("here are the cats");
		console.log(cats);
	}
});

// const pussy = new Cat({
// 	name: 'willy',
// 	age: 9,
// 	character: 'lazy'
// });
// pussy.save(function(err, cat){
// 	if(err){
// 		console.log("error occured");
// 		console.log(err);
// 	}else{
// 		console.log("New cat save");
// 		console.log(cat);
// 	}
// 	});
