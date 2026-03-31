import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";


const registerUser = asyncHandler(async (req,res)=>{
//    get user details from frontend
//    In case ,frontend not available we can use Postman
//    Validation- no any file should be empty
//     check if user already exists: from  username, email
//     check for images and avatar
//     Upload them to cloudinary,avatar
//     create user object - create entry in db 
//     remove password and refresh toen field from response
//     check for user creation 
//     return response finally


const {fullName, email, username, password}= req.body
console.log("email:",email);

//You can check line by line by write if statement for all
// if(fullName ===""){
//     throw new ApiError(400, "Fullname is required")
// }
//Or, A new version of if statement is below

//Validation
if(
    [fullName,email,username,password].some((field)=>
    field?.trim()==="")
){
    throw new ApiError(400,"All field are required")
}

//check if user already exists: from  username, email
const existedUser = User.findOne({
    $or:[{ username },{ email }]
})

if (existedUser) {
    throw new ApiError(409,"user with Username or email existed")
}

//    check for images and avatar

const avatarLocalPath = req.files?.avatar[0]?.path;
const coverImageLocalPath = req.files?.avatar[0]?.path;

if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar File is required")
}

//  upload them to cloudinary

const avatar = await uploadOnCloudinary(avatarLocalPath)
const coverImage = await uploadOnCloudinary(coverImageLocalPath)

if(!avatar){
    throw new ApiError(400,"avatar file is required")
}

//create user object - create entry in db 

const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
})

//     remove password and refresh token field from response


const createdUser = await user.findById(user._id).select(
    "-password -refreshToken"
)

//     check for user creation 

if(!createdUser){
    throw new ApiError(500,"Something went wrong while registerning the user")
}

//     return response finally

return res.status(201).json(
    new ApiResponse(200,createdUser,"User registered succesfully")
)


})

export {
    registerUser,
}