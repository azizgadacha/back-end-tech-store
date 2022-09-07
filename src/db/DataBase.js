const mongoose = require("mongoose");
module.exports.Connection=async ()=>{

    await mongoose.connect(process.env.mongodblink).then(
    ()=>{console.log("connectit")
    })}