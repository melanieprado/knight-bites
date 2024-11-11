const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const saltRounds = 10; 
const nodemailer = require('nodemailer');
const app = express();
const { ObjectId } = require('mongodb');

const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb+srv://KnightBites:KnightBites@knightbites.3mjax.mongodb.net/retryWrites=true&w=majority&appName=KnightBites';

console.log('Attempting to connect to MongoDB...');
const client = new MongoClient(url);
console.log('Attempting to connect to MongoDB2...');

(async () => {
  try {
    await client.connect();
    console.log('MongoDB connected successfully.');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
  }
})();
console.log('Attempting to connect to MongoDB3...');

// *** Configure the email transporter ***
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'knightbitespoosd@gmail.com', 
    pass: 'R3cip3Master',  
  },
});

// *** Function to send the verification email ***
async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: '"KnightBites" <knightbitespoosd@gmail.com>',
    to: email,
    subject: 'Email Verification Code',
    text: `Your verification code is: ${code}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (err) {
    console.error('Failed to send verification email:', err);
  }
}

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  next();
});


//Adds a recipe to recipes table(therefore it will showe under explore AND My recipes)
app.post('/api/addrecipe', async (req, res, next) => {
  // incoming: userId, recipe name, ingredients
  // outgoing: error, success
  const { userId, recipeName, recipeIngredients, imageEncoding } = req.body;  // _id is the userId in this case
  const newRecipe = { recipeName: recipeName, recipeIngredients: recipeIngredients, userId: userId, imageEncoding: imageEncoding };  // Link recipe to userId
  var error = '';
  var success = '';

  try {
    const db = client.db('KnightBites');
    const result = await db.collection('recipes').insertOne(newRecipe);  // Insert recipe with userId

    if (result.insertedId) {
      success = 'Recipe added successfully';
    } else {
      error = 'Failed to add recipe';
    }
  } catch (e) {
    error = e.toString();
  }
  
  var ret = { error: error, success: success };
  res.status(200).json(ret);
});

app.post('/api/verify-email', async (req, res) => {
  const { email, verificationToken } = req.body;
  let error = '';
  let success = '';

  try {
    const db = client.db('KnightBites');

    // Find user by email and verification token
    const user = await db.collection('users').findOne({ email, verificationToken });

    if (user) {
      // Update user as verified
      const result = await db.collection('users').updateOne(
        { email },
        { $set: { isVerified: true }, $unset: { verificationToken: '' } }
      );

      if (result.modifiedCount === 1) {
        success = 'Email verified successfully.';
        res.status(200).json({ success });
      } else {
        error = 'Verification failed.';
        res.status(500).json({ error });
      }
    } else {
      error = 'Invalid verification code.';
      res.status(400).json({ error });
    }
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});


app.post('/api/login', async (req, res, next) => {
  console.log('Login attempt:', req.body);
  const { email, password } = req.body;
  let error = '';

  try {
    const db = client.db('KnightBites');
    const user = await db.collection('users').findOne({ email: email });

    if (!user) {
      error = 'Invalid email or password.';
      return res.status(400).json({ id: -1, firstName: '', lastName: '', error });
    }

    // Check if user is verified
    if (!user.verified) {
      error = 'Please verify your email before logging in.';
      return res.status(400).json({ id: -1, firstName: '', lastName: '', error });
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      error = 'Invalid email or password.';
      return res.status(400).json({ id: -1, firstName: '', lastName: '', error });
    }

    const id = user._id;
    const firstName = user.firstName;
    const lastName = user.lastName;
    const ret = { id, firstName, lastName, error: '' };
    res.status(200).json(ret);

  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
});

app.post('/api/register', async (req, res, next) => {
  const { email, password, firstName, lastName } = req.body;
  let error = '';
  let success = '';

  // Define the email format regex (basic format validation)
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

  // Validate the email format
  if (!emailRegex.test(email)) {
    error = 'Please enter a valid email address.';
    return res.status(400).json({ success, error });
  }

  // Define password requirements
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,16}$/;

  // Validate password against the requirements
  if (!passwordRegex.test(password)) {
    error = 'Password must be 6-16 characters long, contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.';
    return res.status(400).json({ success, error });
  }

  try {
    const db = client.db('KnightBites');

    // Check if a user with the same email already exists
    const existingUser = await db.collection('users').findOne({ email: email });
    if (existingUser) {
      error = 'User with this email already exists.';
      return res.status(400).json({ success, error });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create the new user (with verificationCode and verified: false)
    const newUser = {
      email: email,
      password: hashedPassword,
      firstName: firstName,
      lastName: lastName,
      verified: false, // User is not verified yet
      verificationCode: verificationCode,
    };

    const result = await db.collection('users').insertOne(newUser);

    if (result.insertedId) {
      success = 'User registered successfully. Please check your email for the verification code.';
      
      // Send verification email
      console.log("Sending verification email to: ", email);
      await sendVerificationEmail(email, verificationCode);
    } else {
      error = 'Failed to register user';
    }
  } catch (e) {
    error = e.toString();
  }

  res.status(200).json({ success, error });
});


app.post('/api/searchrecipes', async (req, res, next) => {
  let error = '';
  const { search } = req.body;
  const _search = search.trim();

  try {
    const db = client.db('KnightBites');

    // Search for recipes by recipeName
    const results = await db.collection('recipes').find({
      recipeName: { $regex: _search, $options: 'i' } // Case-insensitive search
    }).toArray();

    // Return the full recipe objects
    res.status(200).json({ results: results, error: error });
  } catch (e) {
    error = e.toString();
    res.status(500).json({ results: [], error: error });
  }
});



app.post('/api/deleteRecipe', async (req, res, next) => {
  const { userId, _id } = req.body;  // incoming: userId, recipe (id)
  let error = '';
  let success = '';

  try {
    const db = client.db('KnightBites');

    // Delete the recipe matching the userId and recipe
    const result = await db.collection('recipes').deleteOne({
      userId: userId,   // Match the userId
      _id: new ObjectId(_id)    // Match the recipe name
    });
    console.log("Delete attempt: userID : " + userId);
    console.log("Delete attempt: _id : " + _id);
    if (result.deletedCount === 1) {
      success = 'Recipe deleted successfully';
    } else {
      error = 'Recipe not found or could not be deleted';
    }
  } catch (e) {
    error = e.toString();
  }

  res.status(200).json({ success, error });
});

//Returns a JSON that contains a list of recipes that user has added(My Recipes)
app.post('/api/displayRecipes', async (req, res, next) => {
  const { userId } = req.body;  // incoming: userId
  let error = '';
  let recipes = [];

  try {
    const db = client.db('KnightBites');

    // Find all recipes that match the userId
    const results = await db.collection('recipes').find({ userId: userId }).toArray();

    if (results.length > 0) {
      // Extract only the recipe names or other desired fields
      recipes = results.map(recipe => recipe);  // assuming 'recipe' field holds the recipe name
    } else {
      error = 'No recipes found for this user.';
    }
  } catch (e) {
    error = e.toString();
  }

  res.status(200).json({ recipes, error });
});




// Endpoint to add a recipe to user's favorites
app.post('/api/favoritesAdd', async (req, res) => {  // <-- Added this endpoint
  const { userId, recipeId } = req.body;

  try {
    const db = client.db('KnightBites');
    const usersCollection = db.collection('users');

    const userObjectId = new ObjectId(userId);
    const recipeObjectId = new ObjectId(recipeId);

    // Add the recipeId to the user's favorites array if it's not already there
    const result = await usersCollection.updateOne(
      { _id: userObjectId },
      { $addToSet: { favorites: recipeObjectId } } // $addToSet prevents duplicates
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ success: 'Recipe added to favorites', error: '' });
    } else {
      res.status(400).json({ success: '', error: 'Failed to add recipe to favorites' });
    }
  } catch (error) {
    res.status(500).json({ success: '', error: error.toString() });
  }
});

// Endpoint to remove a recipe from user's favorites
app.post('/api/favoritesDelete', async (req, res) => {  // <-- Added this endpoint
  const { userId, recipeId } = req.body;

  try {
    const db = client.db('KnightBites');
    const usersCollection = db.collection('users');

    const userObjectId = new ObjectId(userId);
    const recipeObjectId = new ObjectId(recipeId);

    // Remove the recipeId from the user's favorites array
    const result = await usersCollection.updateOne(
      { _id: userObjectId },
      { $pull: { favorites: recipeObjectId } }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ success: 'Recipe removed from favorites', error: '' });
    } else {
      res.status(400).json({ success: '', error: 'Failed to remove recipe from favorites' });
    }
  } catch (error) {
    res.status(500).json({ success: '', error: error.toString() });
  }
});

// Endpoint to get user's favorite recipes
app.post('/api/favoritesGet', async (req, res) => {  // <-- Added this endpoint
  //const userId = req.params.userId;
  const { userId } = req.body;

  try {
    const db = client.db('KnightBites');
    const usersCollection = db.collection('users');
    const recipesCollection = db.collection('recipes');

    const userObjectId = new ObjectId(userId);

    // Find the user's favorites array
    const user = await usersCollection.findOne({ _id: userObjectId }, { projection: { favorites: 1 } });
    console.log(user);
    console.log(userId);
    console.log(userObjectId);
    if (!user) {
      return res.status(404).json({ success: '', error: 'User not found' });
    }

    const favoriteRecipeIds = user.favorites || [];

    // Find the recipes in the favorites array
    const favoriteRecipes = await recipesCollection.find({ _id: { $in: favoriteRecipeIds } }).toArray();

    res.status(200).json({ favorites: favoriteRecipes, error: '' });
  } catch (error) {
    res.status(500).json({ favorites: [], error: error.toString() });
  }
});

app.listen(5000); //Was port

