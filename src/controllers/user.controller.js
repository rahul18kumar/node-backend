import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"
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

    if (!incomingRefreshToken){
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

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword, confirmPass} = req.body

    if (!(confirmPass === newPassword)) {
        throw new ApiError(401,"Confirm Password doesn't match with new pass")
    }

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400,"Invalid Password")
    }

    user.password = newPassword
    await user.save ({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiResponse(200,{},"Password Change Successfully"))
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName, email}= req.body

    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }

const user = User.findByIdAndUpdate(
    req.User?._id,
    {
        $set :{
            fullName,   // or can be, fullName : fullName
            email,      // or can be , email : email
        }
    },
    {new:true}
)
.select("-password")

return res
.status(200)
.json(new ApiResponse(200, user, "Account detail updated successfully"))


})

const updateUserAvatar = asyncHandler (async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400,"avatar file is missing")
    }

    const existingUser = await User.findById(req.user?._id);

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400,"Error while uploading avatar")
    }

     if (existingUser?.avatar) {
        const warning = null;
        try {
            const publicId = existingUser.avatar
                .split("/")        // break URL
                .pop()             // get last part
                .split(".")[0];    // remove extension

            await deleteFromCloudinary(publicId);
        } catch (error) {
             warning = "Old avatar could not be deleted";
        }
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set :{
                avatar: avatar.url,
            }
        },
        {new:true},
    ).select ("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated succesfully"))
})

const updateUserCoverImage = asyncHandler (async(req,res)=> {
    const coverimageLocalpath = req.file?.path

    if (!coverimageLocalpath) {
        throw new ApiError(400, "CoverImage missing")
    }

    const existingUser = await User.findById(req.user?._id);

    const coverimage = await uploadOnCloudinary(coverimageLocalpath)

    if (!coverimage.url) {
        throw new ApiError(400, "Error while updating coverimage")
    }

    if (existingUser?.coverimage) {
        const warning = null;
        try {
            const publicId = existingUser.coverimage
                .split("/")        // break URL
                .pop()             // get last part
                .split(".")[0];    // remove extension
            await deleteFromCloudinary(publicId);
        } catch (error) {
            warning = "Old coverimage could not be deleted";
    }
}

    const user = await User.findByIdAndUpdate(
        req.User?._id,
        {
            $set:{
                coverimage : coverimage.url
            },
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(200, user,"Coverimage updated succesfully")
})

const getUserChannelProfile  = asyncHandler (async (req,res)=>{
    const {username}= req.params

    if (!username?.trim()) {
        throw new ApiError(400,"Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username : username?.toLowerCase()
            }
        },
        {
            $lookup:{       //Get all subscribers of this User
                from: "subscriptions",  // collection to join
                localField: "_id",         // current user id
                foreignField:"channel",     // field in subscriptions
                as: "subscribers"               // output array (followers)
            }
        },
        {
            $lookup:{       //Get all channels this user subscribed to
                from:"subscriptions",      // collection to join    
                localField:"_id",          // current user id
                foreignField:"subscriber",  // field in subscriptions
                as:"subscribedTo"            // output array (following)
            }
        },
        {
            $addFields:{
                subscribersCount :{
                    $size:"$subscribers"                
                },
                channelSuubscriberToCount :{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else:false
                    }
                }
            }

        },
        {
            $project :{
                avatar:1,
                coverImage:1,
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSuubscriberToCount: 1,
                isSubscribed: 1
            }
        },
    
    ])

    if (!channel?.length) {
        throw new ApiError(404,"channel doesn't exist")
    }

    console.log("channel information",channel);

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0], "User channel fetched succesfully")
    )

})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user.__id)
            }
        },
        {
            $lookup:{
                from :"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistoryVideos",
                pipeline :[
                    {
                        $lookup:{
                            form :"users",
                            localField:"owner",
                            foreignField:"_id",
                            as :"owner",
                            pipeline:[
                                {
                                    $project: {
                                        fullName:1,
                                        username:1,
                                        avatar:1

                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]

            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "watch history  fetched succesfully"
        )
    )
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}