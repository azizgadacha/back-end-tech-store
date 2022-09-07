
const  mongoose=require("mongoose")


const User = new mongoose.Schema({

username: String,

email: String,
phone:Number,
adress:String,
state:String,
password: String,
photo:String,
date:{type:Date,
    default: Date.now
},

},)

module.exports=mongoose.model("User",User)