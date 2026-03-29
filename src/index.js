// import 'dotenv/config'

import dotenv from "dotenv";
import connectDB from "./db/index.js"
import { app } from "./app.js";

dotenv.config({
    path:'./env'
})


connectDB()
.then(()=>{
    app.on("error",(error)=>{
    console.log("Error", error);
    throw error
    });

    app.listen(process.env.PORT || 8000,()=>{
        console.log(`server is running at port: ${process.env.PORT}`);
    });
})

.catch((err)=>{
    console.log("Mongodb Connection failed !!", err);
})













// First approach of connecting database through iife

// import express from "express";
// const app = express();

// ;(async ()=>{
//  try {
//     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//     app.on("error",(error)=>{
//         console.log("Error", error);
//         throw error
//     })

//     app.listen(process.env.PORT,()=>{
//         console.log(`Ap is listening on port ${process.env.PORT}`)
//     })

// } catch (error) {
//     console.log("Error:",error)
//     throw error
//  }
// })()

// connectDB()