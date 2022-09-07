
const  mongoose=require("mongoose")


const Product = new mongoose.Schema({

productName: String,

description: String,
Price:Number,
Rating:Number,
type:String,
date:{type:Date,
    default: Date.now
},

},)

module.exports=mongoose.model("Product",Product)