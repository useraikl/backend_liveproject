import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User }  from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
   try {
       const user = await User.findById(userId)
       const accessToken = user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()

       user.refreshToken = refreshToken
      await user.save({ validateBeforeSave: false})

      return { accessToken, refreshToken }

   } catch (error) {
    console.error("Token generation error:", error);
    throw new ApiError(500,"Unable to generate tokens, please try again later")
   }
}


const registerUser = asyncHandler(async (req, res) => {
 // get user details from frontend
 // validation - not empty
 // check if user already exists:username,email
 // check for images, check for avatar
 //upload them to cloudinary ,avatar
 // create user object - create entry in db
// remove password and refresh token field from response
// check for user creation
// return response

const { username, email, fullName, password } = req.body
console.log("email: ",email);

if ([username, email, fullName, password].some((field) => field?.trim()==="")) 
    {
    throw new ApiError(400,"All fields are required")

  }
const existedUser = await User.findOne({
  $or:[{username},{email}]
})
if (existedUser){
    throw new ApiError (409,"User already exists with this username or email")
}
const avatarLocalPath = req.files?.avatar[0]?.path;
const coverImageLocalPath = req.files?.coverImage[0]?.path;

if (!avatarLocalPath){
    throw new ApiError(400,"Avatar image is required")
   }

const avatar = await uploadOnCloudinary(avatarLocalPath)
const coverImage =  await uploadOnCloudinary(coverImageLocalPath) 

if (!avatar){
    throw new ApiError (400,"Unable to upload avatar image, please try again later")
   }

const user = await User.create({
  fullName,
  avatar: avatar.url,
  coverImage: coverImage?.url || "",
  username : username.toLowerCase(),
  email,
  password
   })
   const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser){
        throw new ApiError(500,"Unable to create user, please try again later") 
    }

    return res.status(201).json(
      new ApiResponse(201,"User registered successfully",createdUser)
    )
})

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  //  validation -not empty
  //username or email
 // check if user exists
  // check for password correctness
 // generate access token
 // generate refresh token
 // send cookies
 // return response

  const { username ,email, password } = req.body

  if (!(username || email)){
    throw new ApiError(400,"Username or email is required")
  }

   const user = await User.findOne({
    $or: [{username},{email}]
   })

    if (!user){
      throw new ApiError(404, "User does not exist")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect){
      throw new ApiError (401,"Invalid user credentials")
    }

   const { accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

   const loggedInUser= await User.findById(user._id).select("-password -refreshToken")

   const cookieOptions = {
    httpOnly: true,
    secure: true
   }

   return res
   .status(200)
   .cookie("accessToken", accessToken, cookieOptions)
   .cookie("refreshToken", refreshToken, cookieOptions)
   .json(
    new ApiResponse
    (
      200,
      {
            user: loggedInUser ,accessToken, refreshToken

      },
      "User logged in successfully"
      
      ))

})

const loggedOutUser = asyncHandler(async (req, res) => {

 await User.findByIdAndUpdate(req.user._id, { $set: {
    refreshToken: undefined
       }
  },
  { 
    new: true 
  }
)

const cookieOptions = {
    httpOnly: true,
    secure: true,
   }  

    return res.
    status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(
        new ApiResponse(
            200,
            {},
            "User logged out successfully"
        )
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {

const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

if (!incomingRefreshToken){
    throw new ApiError(401,"Refresh token is required")
   }


try {
  const decodedToken=  jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      )
  
  const user = await User.findById(decodedToken?._id)
  
  if(!user)
  {
      throw new ApiError(401,"Invalid refresh token")
  }
  
  if (user?.refreshToken !== incomingRefreshToken){
      throw new ApiError(401,"Refresh token mismatch, please login again")
     }
  
  const options = {
      httpOnly: true,
      secure: true,
     }
     const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
  
      return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
          new ApiResponse(
              200,
              { accessToken, refreshToken: newRefreshToken },
              "Access token refreshed successfully"
          )
      )
  
} catch (error) {
  throw new ApiError(401,error?.message || "Invalid or expired refresh token")  
   }
})
 
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  const user = await User.findById(req.user?._id)


export { registerUser , loginUser , loggedOutUser , refreshAccessToken };