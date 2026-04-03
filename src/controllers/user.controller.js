import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

//generate -  access and refresh token
const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        console.log(accessToken);
        console.log(refreshToken);

        return {accessToken, refreshToken}
      

    } catch (error) {
        // console.log("JWT ERROR:", error) 
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

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
const existedUser = await User.findOne({
    $or:[{ username },{ email }]
})

if (existedUser) {
    throw new ApiError(409,"user with Username or email existed")
}

//  check for images and avatar

const avatarLocalPath = req.files?.avatar[0]?.path;
// const coverImageLocalPath = req.files?.coverImage[0]?.path;
//Classic method of checking is coverimage available or not

let coverImageLocalPath;
if (req.files && Array.isArray(req.files.coverImage)
 && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
}

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

//  remove password and refresh token field from response

const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
)

//   check for user creation 

if(!createdUser){
    throw new ApiError(500,"Something went wrong while registerning the user")
}

//   return response finally

return res.status(201).json(
    new ApiResponse(200,createdUser,"User registered succesfully")
)

})


const loginUser = asyncHandler(async (req,res)=>{

//fetch data from req body -> data
//username or email
//find the user
//password check
//access and refresh token
//send cookies
//return response

//fetch data from req body -> data
const {email, username, password} = req.body

//username or email
if (!(username || email)) {
    throw new ApiError(400, "username or email is required")
}

//find the user
const user = await User.findOne({
    $or : [{username},{email}]
})

if(!user){
    throw new ApiError(404,"User does not exist")
}

//password check
const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
       req.user._id,
       {
        $set:{
            refreshToken : undefined
        }
       },
       {
        new:true
       }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
   
})

const refreshAccessToken = asyncHandler(async (req, res)=>{
    const incomingRefreshToken = 
    req.cookies.refreshToken || req.body.refreshToken

    if (incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }

    try {
        // Check if refresh token is valid (not expired/tampered) 
        // and decode it to get user information (like userId)
    
        const decodedToken = jwt.verify(
            incomingRefreshToken, 
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        //now compare for validation refresh token form database and incoming from cookies(browser)
        if (incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        //if they both match
        const options = {
            httpOnly :true,
            secure :true
        }
    
        const {accessToken, newRefreshToken } = await generateAccessAndRefereshTokens(User._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("newRefreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200,
                { accessToken, refreshToken : newRefreshToken},
                "Access Token Refresh"
    
            )
        )
    
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}