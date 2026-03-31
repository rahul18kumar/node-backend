import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async()=>{
    try {
        const ConnectionInstance= await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n Mongodb Connected, DB host : ${ConnectionInstance.connection.host}`);
        
    } catch (error) {
        console.log("MONGODB Connection error",error);
        process.exit(1)
    }
}

export default connectDB