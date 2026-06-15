import mongoose, { Schema, InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
    versionKey: false,
  }
);

// Explicit index definition is clearer in production code
userSchema.index({ email: 1 }, { unique: true });

// Hide sensitive fields when converting to JSON/objects
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).passwordHash;
    delete (ret as any).__v;
    return ret;
  },
});

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User =
  mongoose.models.User || mongoose.model('User', userSchema);