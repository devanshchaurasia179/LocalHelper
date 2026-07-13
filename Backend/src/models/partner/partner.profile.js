// Personal Information & Address fields
const profileFields = {
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },
  dateOfBirth: Date,
  profilePhoto: String,
  selfiePhoto: String,
  address: {
    house: String,
    street: String,
    locality: String,
    city: String,
    state: String,
    pincode: String,
  },
};

export default profileFields;
