//Project import
const express=require("express")
const app=express()
const cors=require("cors")
const compression =require("compression")



const connection=require( './db/DataBase');



app.use(cors());

require("dotenv").config()
connection.Connection()
app.use(express.json());

app.use(compression());

app.use(express.urlencoded({extended:true}))
app.use(express.static('upload'))
app.use(express.json())

//Routes  declaration

//app.use("/api/User",UserRoutes)

let port=process.env.PORT||5000

const server=app.listen(port,()=>{
})

let UserConnected=[]


app.listen(5000)
