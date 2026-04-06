import mongoose from "mongoose";

const tweetSchema = new Schema(
    {
                coontent:{
                    type: String,
                    required: true
                },
                owner:{
                    type: Schema.Types.ObjectId,
                    ref:"User"
                }
    },
    {
        timestamps: true
    }
)

export const Tweet = mongoose.model("Tweet", tweetSchema)