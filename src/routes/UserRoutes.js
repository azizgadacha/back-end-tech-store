const express=require('express');

const multer=require('multer')

const fileStorage=multer.diskStorage(
    {
        destination:(req,file,cb)=>{
            cb(null,'./upload')
        },
        filename:(req,file,cb)=>{
            cb(null,Date.now()+'--'+Math.floor(Math.random()*1000)+file.originalname.replace(/\s+/g,'-'))
        }
    }
)
const upload=multer({storage:fileStorage});


const router = express.Router();


//import  User
const {
       getall,
       } =require( '../controller/UserController');


//Router  User

router.post('/getAll', getall);





module.exports= router;
