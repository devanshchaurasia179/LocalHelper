import mongoose from "mongoose"
export const connectDB=async ()=>{
    try{
        const conn=await mongoose.connect(process.env.MONGO_URI);
        console.log(`Mongo DB connected: ${conn.connection.host}`);
    }catch(error){
        console.log("Error in connecting Mongo DB",error)
        process.exit(1);//1means failure code
    }
}