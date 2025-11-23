import express from 'express';
import path from 'path';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { ObjectId } from 'mongodb';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: './secrets.env' });

// unique ID generation for sessions
import {v4 as uuidv4} from 'uuid';

const app = express();
const port = process.env.PORT;
const __dirname = path.resolve();
const saltRounds = 10;

// initialize session (WIP)
app.use(session(
  { name:'SessionCookie',
    genid: function(req) {
      //console.log('Generated session id');
      return uuidv4();
    },
    secret: 'secretpass',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 3600 * 1000 }
  }));

app.use(express.urlencoded({ extended: true })); // Add this line for form data
app.use(express.json()); // Add this for JSON parsing
app.use((req, res, next) => {
    res.locals.currentUser = req.session.userInfo || null;
    next();
});

// MongoDB connection setup
const uri = process.env.MONGODB_CONN;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  }
});

async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1); // Exit the process if there's an error connecting to MongoDB
  }
}

// Initialize MongoDB connection
connectToMongoDB();

// Logging utility function
async function logEvent(level, message, userId = null, ip = null) {
  try {
    const logsCollection = client.db("ForumsDB").collection("Logs");
    
    const logEntry = {
      timestamp: new Date(),
      level: level, // 'error', 'warn', 'info', 'debug'
      message: message,
      userId: userId,
      ip: ip || 'unknown'
    };
    
    await logsCollection.insertOne(logEntry);
    console.log(`[${level.toUpperCase()}] ${message}`);
    
  } catch (error) {
    console.error("Failed to write log:", error);
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.set("view engine", "ejs");
app.set("views", "views");

app.use('/', express.static('public'))

app.get('/', (req, res) =>{

  res.render("login")

});

// Make user data available in all templates - CORRECTED VERSION
app.use((req, res, next) => {
  // Check if user is logged in and session exists
  if (req.session && req.session.userInfo) {
    res.locals.user = req.session.userInfo;
  } else {
    res.locals.user = null;
  }
  next();
});

app.get('/index', (req, res) =>{
  logEvent('info', 'Index page accessed', req.session.userInfo?._id?.toString());
  res.render("index")
});

// gets posts
app.get('/posts', async (req,res) =>{
  try {
    const postCollection = client.db("ForumsDB").collection("Posts");
    const cursor = postCollection.find();
    
    if ((postCollection.countDocuments()) === 0) {
      console.log("No documents found!");
    }

    const array =  await cursor.toArray();
    logEvent('info', 'Posts fetched from database', req.session.userInfo?._id?.toString());
    res.status(200).json(array);
  } catch (error) {
    logEvent('error', `Error fetching posts: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// gets comments
app.get('/comments', async (req,res) =>{
  try {
    const commCollection = client.db("ForumsDB").collection("Comments");
    const cursor = commCollection.find();
    
    if ((commCollection.countDocuments()) === 0) {
      console.log("No comment documents found!");
    }

    const array =  await cursor.toArray();
    logEvent('info', 'Comments fetched from database', req.session.userInfo?._id?.toString());
    res.status(200).json(array);
  } catch (error) {
    logEvent('error', `Error fetching comments: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/postComment', async (req,res) =>{
  try {
    const commentCollection = client.db("ForumsDB").collection("Comments");
    const date = new Date(Date.now()).toUTCString();
    
    const {comment,postID,authorID} = req.body;
    
    if (!req.session.userInfo) {
      logEvent('warn', 'Unauthorized comment attempt');
      return res.redirect('/login');
    }

    const result = await commentCollection.insertOne({
      comment:comment,
      date:date,
      authorID:authorID,
      postID:postID,
      dislikes: 0,
      likes: 0,
    });

    logEvent('info', `Comment posted on post ${postID} by user ${authorID}`, authorID);
    res.redirect("/viewpost?postID="+postID);
  } catch (error) {
    logEvent('error', `Error posting comment: ${error.message}`, req.session.userInfo?._id?.toString());
    res.status(500).json({ error: "Internal server error" });
  }
});

// gets likes
app.get('/likes', async (req,res) =>{
  try {
    const likeCollection = client.db("ForumsDB").collection("Likes");
    const cursor = likeCollection.find();
    
    if ((likeCollection.countDocuments()) === 0) {
      console.log("No comment documents found!");
    }

    const array =  await cursor.toArray();
    logEvent('info', 'Likes data fetched', req.session.userInfo?._id?.toString());
    res.status(200).json(array);
  } catch (error) {
    logEvent('error', `Error fetching likes: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// for when a user sends a like or a dislike
app.get('/like', async (req,res) =>{
  try {
    if(req.query.postID && req.session.userInfo) {
      const likeCollection = client.db("ForumsDB").collection("Likes");
      const postCollection = client.db("ForumsDB").collection("Posts");
      const commCollection = client.db("ForumsDB").collection("Comments");
      var likeValue = 1;
      var likerID = String(req.session.userInfo._id);
      var postID = req.query.postID
      var postObjID = new ObjectId(postID);
      var postTarget = await postCollection.findOne({_id: postObjID});

      if(req.query.likeValue) {
        likeValue = req.query.likeValue;
      }

      const filter = { likerID: likerID, postID: postID };
      const updates = {like:likeValue};
      
      await likeCollection.updateOne(filter, { $set: updates },{upsert:true});

      const newLikeCollection = client.db("ForumsDB").collection("Likes");
      const cursor = newLikeCollection.find({postID: postID});
      const likeArray = await cursor.toArray();

      if(postTarget) {
        await postCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
        await postCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

        let likes = 0;
        let dislikes = 0;
        likeArray.forEach((likeDocument) => {
          if(likeDocument.like == '1') {
            likes++;
          }
          else if(likeDocument.like == '-1') {
            dislikes++;
          }
        }) 

        const postCursor = await postCollection.findOneAndUpdate({_id: postObjID}, {$set: {likes, dislikes}},{returnDocument:'after'})
        
        const action = likeValue == '1' ? 'liked' : 'disliked';
        logEvent('info', `User ${action} post ${postID}`, likerID);
        return res.status(200).json(postCursor);
      }
      else {
        postTarget = await commCollection.findOne({_id: postObjID});
        if(postTarget) {
          await commCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
          await commCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

          likeArray.forEach((like) => {
            if(like.like == '1') {
              commCollection.updateOne({_id: postObjID}, {$inc: {likes: 1}})
            } else if (like.like == '-1') {
              commCollection.updateOne({_id: postObjID}, {$inc: {dislikes: 1}})
            }
          })
        }
      }
    } else {
      logEvent('warn', 'Unauthorized like attempt');
      return res.status(404).json({ message: "Like request failed" });
    }
  } catch (error) {
    logEvent('error', `Error processing like: ${error.message}`, req.session.userInfo?._id?.toString());
    return res.status(500).json({ message: "Internal server error" });
  }
});

// updates likes and dislikes value of a post/comment based on what is on 'Likes' collection of the db
app.get('/updateLikes', async (req, res) => {
  try {
    if(req.query.postID) {
      const likeCollection = client.db("ForumsDB").collection("Likes");
      const postCollection = client.db("ForumsDB").collection("Posts");
      const commCollection = client.db("ForumsDB").collection("Comments");
      var postID = req.query.postID;
      var postObjID = new ObjectId(postID);
      var postTarget = await postCollection.findOne({_id: postObjID});
      const cursor = likeCollection.find({postID: postID});
      const likeArray = await cursor.toArray();

      if(postTarget) {
        await postCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
        await postCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

        likeArray.forEach((like) => {
          if(like.like == '1') {
            postCollection.updateOne({_id: postObjID}, {$inc: {likes: 1}})
          } else if (like.like == '-1') {
            postCollection.updateOne({_id: postObjID}, {$inc: {dislikes: 1}})
          }
        })
        logEvent('info', `Likes updated for post ${postID}`);
      }
      else {
        postTarget = await commCollection.findOne({_id: postObjID});
        if(postTarget) {
          await commCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
          await commCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

          likeArray.forEach((like) => {
            if(like.like == '1') {
              commCollection.updateOne({_id: postObjID}, {$inc: {likes: 1}})
            } else if (like.like == '-1') {
              commCollection.updateOne({_id: postObjID}, {$inc: {dislikes: 1}})
            }
          })
          logEvent('info', `Likes updated for comment ${postID}`);
        }
      }
    }
  } catch (error) {
    logEvent('error', `Error updating likes: ${error.message}`);
  }
});

app.get('/trending',async (req,res)=> {

  const postCollection = client.db("ForumsDB").collection("Posts");
  
  // Execute query 
  const cursor = postCollection.find().sort({likes:-1});
  
  // Print a message if no documents were found
  if ((postCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }

  const array =  await cursor.toArray();

  res.status(200).json(array);
  

});

// gets a single post (WIP)
app.get('/onePost', async (req,res) =>{

  try{
    const postCollection = client.db("ForumsDB").collection("Posts");
    var postID = req.header('postID');
    var postObjID = new ObjectId(postID);

    console.log('Received post ID: ' + postID);

    // Execute query 
    var postToSend = await postCollection.findOne({ _id: postObjID });

    console.log('post found to send has the subject of: ' + postToSend.subject);
    
    const postData = [{
      '_id': postToSend._id, 
      'subject': postToSend.subject,
      'message': postToSend.message,
      'tag': postToSend.tag,
      'date': postToSend.date,
      'dislikes': postToSend.dislikes,
      'likes': postToSend.likes,
      'authorID': postToSend.authorID
    }];

    // sends post back
    if(postData) {
      console.log("post sent");
      res.json(postData);
    }
    else {
      console.error('Error finding post to send back', error);
      return res.status(404).json({ message: "Post not found." });
    }

  } catch (error) {
    console.log("Error locating single post", error);
  }

});

// gets a single comment
app.get('/oneComment', async (req,res) =>{

  try{
    const commCollection = client.db("ForumsDB").collection("Comments");
    var commID = req.header('commID');
    var commObjID = new ObjectId(commID);

    console.log('Received comment ID: ' + commID);

    // Execute query 
    var commToSend = await commCollection.findOne({ _id: commObjID });

    console.log('comment found to send has the subject of: ' + commToSend.comment);
    
    const commData = [{
      '_id': commToSend._id,
      'comment': commToSend.comment,
      'date': commToSend.date,
      'authorID': commToSend.authorID
    }];

    // sends comment back
    if(commData) {
      console.log("comment sent");
      res.json(commData);
    }
    else {
      console.error('Error finding comment to send back', error);
      return res.status(404).json({ message: "Comment not found." });
    }

  } catch (error) {
    console.log("Error locating single comment", error);
  }

});

app.get('/categories',async (req,res)=>{

  const postCollection = client.db("ForumsDB").collection("Posts");

  // Execute query 
  const cursor = await postCollection.distinct("tag");

  // Print a message if no documents were found
  if ((postCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }
  
  res.status(200).json(cursor);
  
});

app.get('/filter', async (req, res) => {

  const postCollection = client.db("ForumsDB").collection("Posts");
  const searchStr = req.query.search;
  const sortStr = req.query.sort;
  const categoryStr = req.query.category;

  console.log("looking for: "+searchStr)
  console.log("sorted  by:  "+sortStr)
  console.log("with category: "+categoryStr)
  console.log("----------------------------")

  const query = {
    subject:{$regex:searchStr},
    tag:{$regex:categoryStr}
  }

  //sort by newest
  let sort = {};

  if (sortStr == "Alphabetical"){

    sort = {subject:-1}

  }
  else if (sortStr == "Oldest"){

    sort = {_id:-1}

  }


  // Execute query 
  const cursor = postCollection.find(query).collation({'locale':'en'}).sort(sort);

  // Print a message if no documents were found
  if ((postCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }

  const array =  await cursor.toArray();

  
  res.status(200).json(array);
})

app.get('/logout', (req, res) => {
  const userId = req.session.userInfo?._id?.toString();
  const username = req.session.userInfo?.username;
  
  req.session.destroy((err) => {

    if (err) {
      logEvent('error', `Error destroying session: ${err.message}`, userId);
      return res.status(500).json({ message: "Internal server error." });
    }
    logEvent('info', `User logged out: ${username}`, userId);
    req.session.userInfo = null;
    res.clearCookie('SessionCookie');
    res.redirect('/login');
  });
});

// Handle editing profile and validation that username is unique (WIP)
app.post('/editProfile', async (req, res) => {
  try {
    console.log("edit Profile function started");
    const { usernameInput, profilePicInput, genderInput, dlsuIDInput, roleInput, descInput } = req.body;
    const usersCollection = client.db("ForumsDB").collection("Users");
    const sessionUser = req.session.userInfo;
    const user = await usersCollection.findOne({ username: sessionUser.username });

    if (!user) {
      console.error("User editing error: User not found");
      return res.status(404).json({ message: "User not found." });
    } else {
      if (usernameInput) {
        // Check if the new username already exists in the database
        const existingUser = await usersCollection.findOne({ username: usernameInput });
        if (existingUser && existingUser.username !== sessionUser.username) {
          console.error("User editing error: Username already exists");
          return res.status(400).json({ message: "Username already exists." });
        }
      }

      const filter = { username: sessionUser.username };
      const updates = {};

      if (usernameInput) {
        updates.username = usernameInput;
      }
      if (profilePicInput) {
        updates.profilePic = profilePicInput;
      }
      if (genderInput) {
        updates.gender = genderInput;
      }
      if (dlsuIDInput) {
        updates.dlsuID = dlsuIDInput;
      }
      if (roleInput) {
        updates.dlsuRole = roleInput;
      }
      if (descInput) {
        updates.description = descInput;
      }

      // Update the user document with the accumulated updates
      await usersCollection.updateOne(filter, { $set: updates });

      // Update current user with the new profile information
      Object.assign(req.session.userInfo, updates);

      logEvent('info', `Profile updated for user ${username || req.session.userInfo.username}`, userID.toString());
      return res.redirect('/profile');
      
      
    }
  } catch (error) {
    logEvent('error', `Error during user edit: ${error.message}`, userID.toString());
    //TODO:CHANGES END HERE
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/userPosts', async (req,res) =>{
  let userID = req.header('userID');

  if(userID){
    try{
      const postCollection = client.db("ForumsDB").collection("Posts");
      const cursor = postCollection.find({authorID:userID});
    
      if ((await postCollection.countDocuments({authorID:userID})) === 0) {
        console.log("No documents found!");
      }
    
      const array =  await cursor.toArray();
      logEvent('info', `User posts fetched for user ${userID}`);
      res.status(200).json(array);
    }
    catch(error){
      logEvent('error', `Error locating user posts: ${error.message}`);
    }
  }
});

app.get('/login', (req, res) =>{
  logEvent('info', 'Login page accessed');
  res.render("login", { error: null });
});

// Handle login process with attempt tracking and lockout
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userIP = req.ip || req.connection.remoteAddress;

    if (!email || !password) {
      logEvent('warn', 'Login attempt with missing credentials', null, userIP);
      return res.render("login", { error: "Email and password are required." });
    }

    const usersCollection = client.db("ForumsDB").collection("Users");
    const user = await usersCollection.findOne({ email: email });

    if (!user) {
      logEvent('warn', `Failed login attempt for non-existent email: ${email}`, null, userIP);
      return res.render("login", { error: "Invalid email or password." });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000);
      logEvent('warn', `Login attempt on locked account: ${email}`, user._id.toString(), userIP);
      return res.render("login", { 
        error: `Account is locked. Please try again in ${remainingTime} seconds.`,
        lockout: true,
        remainingTime: remainingTime
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      // Increment failed login attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updates = { failedLoginAttempts: failedAttempts };

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        updates.lockUntil = Date.now() + 30000;
        updates.failedLoginAttempts = 0;
        
        await usersCollection.updateOne({ email: email }, { $set: updates });
        
        logEvent('warn', `Account locked due to too many failed attempts: ${email}`, user._id.toString(), userIP);
        return res.render("login", { 
          error: "Too many failed login attempts. Account locked for 30 seconds.",
          lockout: true,
          remainingTime: 30
        });
      }

      await usersCollection.updateOne({ email: email }, { $set: updates });
      
      const attemptsLeft = 5 - failedAttempts;
      logEvent('warn', `Failed login attempt for user: ${user.username} (${attemptsLeft} attempts left)`, user._id.toString(), userIP);
      return res.render("login", { 
        error: `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`,
        attemptsLeft: attemptsLeft
      });
    }

    // Successful login - reset failed attempts and lock
    await usersCollection.updateOne(
      { email: email },
      { 
        $set: { failedLoginAttempts: 0 },
        $unset: { lockUntil: "" }
      }
    );

    // Set session and redirect
    req.session.userInfo = user;

    logEvent('info', `User logged in successfully: ${user.username}`, user._id.toString(), userIP);
    return res.redirect('/index');

  } catch (error) {
    logEvent('error', `Login error: ${error.message}`);
    console.error("Error occurred during login:", error);
    return res.render("login", { error: "Internal server error." });
  }
});

// Forgot password page
app.get('/forgot-password', (req, res) => {
  logEvent('info', 'Forgot password page accessed');
  res.render("forgot-password", { step: 1, error: null });
});

// Handle forgot password - verify email and security question
app.post('/forgot-password', async (req, res) => {
  try {
    const { email, securityAnswer, newPassword, confirmPassword } = req.body;
    const usersCollection = client.db("ForumsDB").collection("Users");

    // Step 1: Verify email and show security question
    if (email && !securityAnswer) {
      const user = await usersCollection.findOne({ email: email });
      
      if (!user) {
        logEvent('warn', `Password reset attempt for non-existent email: ${email}`);
        return res.render("forgot-password", { 
          step: 1, 
          error: "Email address not found." 
        });
      }

      if (!user.securityQuestion || !user.securityAnswer) {
        logEvent('warn', `Password reset attempt for account without security question: ${email}`);
        return res.render("forgot-password", { 
          step: 1, 
          error: "No security question set for this account. Please contact support." 
        });
      }

      logEvent('info', `Password reset initiated for: ${email}`, user._id.toString());
      return res.render("forgot-password", { 
        step: 2, 
        email: email,
        securityQuestion: user.securityQuestion,
        error: null 
      });
    }

    // Step 2: Verify security answer and reset password
    if (email && securityAnswer && newPassword) {
      const user = await usersCollection.findOne({ email: email });

      if (!user) {
        return res.render("forgot-password", { 
          step: 1, 
          error: "Email address not found." 
        });
      }

      // Verify security answer (case-insensitive)
      if (user.securityAnswer.toLowerCase() !== securityAnswer.toLowerCase()) {
        logEvent('warn', `Incorrect security answer for password reset: ${email}`, user._id.toString());
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: "Incorrect answer to security question." 
        });
      }

      // Validate new password
      if (newPassword !== confirmPassword) {
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: "Passwords do not match." 
        });
      }

      // Validate password requirements
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: passwordValidation.message 
        });
      }

      // Check password history - prevent reusing last 5 passwords
      const passwordHistory = user.passwordHistory || [];
      
      // Check current password
      const isCurrentPassword = await bcrypt.compare(newPassword, user.password);
      if (isCurrentPassword) {
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: "Cannot reuse your current password. Please choose a different password." 
        });
      }

      // Check against password history (last 5 passwords)
      for (let oldHash of passwordHistory) {
        const isOldPassword = await bcrypt.compare(newPassword, oldHash);
        if (isOldPassword) {
          return res.render("forgot-password", { 
            step: 2,
            email: email,
            securityQuestion: user.securityQuestion,
            error: "Cannot reuse any of your last 5 passwords. Please choose a different password." 
          });
        }
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Add current password to history before updating
      const updatedHistory = [...passwordHistory, user.password];
      // Keep only the last 5 passwords in history
      const trimmedHistory = updatedHistory.slice(-5);

      // Update with new password and history
      await usersCollection.updateOne(
        { email: email },
        { 
          $set: { 
            password: hashedPassword,
            passwordHistory: trimmedHistory,
            failedLoginAttempts: 0
          },
          $unset: { lockUntil: "" }
        }
      );

      logEvent('info', `Password reset successful for: ${email}`, user._id.toString());
      return res.render("forgot-password", { 
        step: 3,
        success: true,
        error: null 
      });
    }

  } catch (error) {
    logEvent('error', `Password reset error: ${error.message}`);
    console.error("Error during password reset:", error);
    return res.render("forgot-password", { 
      step: 1, 
      error: "Internal server error." 
    });
  }
});

// Password validation function
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < minLength) {
    return { 
      isValid: false, 
      message: `Password must be at least ${minLength} characters long.` 
    };
  }

  if (!hasUpperCase) {
    return { 
      isValid: false, 
      message: "Password must contain at least one uppercase letter." 
    };
  }

  if (!hasNumber) {
    return { 
      isValid: false, 
      message: "Password must contain at least one number." 
    };
  }

  if (!hasSpecialChar) {
    return { 
      isValid: false, 
      message: "Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)" 
    };
  }

  return { isValid: true, message: "Password is valid." };
}

// function for getting profile info
app.get('/userData', async (req, res) => {
  let userID = req.header('userID');
  
  if (userID === null || userID === "null"){
    try{
      userID = req.session.userInfo._id;
    }
    catch(err){
      console.log("Cannot read user id");
    }
    if (userID === null || userID === "null"){
      logEvent('warn', 'Unauthorized user data access attempt');
      return res.status(401).json({message:"No logged in user found",status:401});
    }
  }
  if(userID){
    try{
      const usersCollection = client.db("ForumsDB").collection("Users");
      var userToSend = await usersCollection.findOne({ _id: new ObjectId(userID) });
      
      if(!userToSend) {
        logEvent('warn', `User data not found for ID: ${userID}`);
        return res.status(404).json({ message: "User not found or could not be deleted." });
      }
  
      const userData = [{
        '_id': userToSend._id,
        'username': userToSend.username,
        'profilePic': userToSend.profilePic,
        'dlsuID': userToSend.dlsuID,
        'dlsuRole': userToSend.dlsuRole,
        'gender': userToSend.gender,
        'description': userToSend.description
      }];
      
      if(userData) {
        logEvent('info', `User data fetched for: ${userToSend.username}`, userID);
        res.json(userData);
      }
    } catch (error) {
      logEvent('error', `Error locating user: ${error.message}`);
    }
  }  
})

app.get('/profile', (req, res) =>{
  logEvent('info', 'Profile page accessed', req.session.userInfo?._id?.toString());
  res.render("profile");
});

app.get('/create',(req, res) =>{
  logEvent('info', 'Create post page accessed', req.session.userInfo?._id?.toString());
  res.render("create");
});

// registers posts into the db
app.post('/create', async (req,res) => {
  
  try{

    let sessionUser = req.session.userInfo;
        
    if (!sessionUser) {
      logEvent('warn', 'Unauthorized post creation attempt');
      return res.redirect('/login');
    }
    const {subject,message,tag} = req.body;

    if (!subject || !message || !tag){
      logEvent('warn', `Incomplete post data from user: ${userID.username}`, userID._id.toString());
      return res.redirect('/create');
    }
    
    const date = new Date(Date.now()).toUTCString();
    const postsCollection = client.db("ForumsDB").collection("Posts");

    const result = await postsCollection.insertOne({
      author:sessionUser.username,
      authorPic:sessionUser.profilePic,
      subject:subject,
      message:message,
      tag:tag,
      date:date,
      dislikes: 0,
      likes: 0,
      authorID:sessionUser._id.toString(),
    });

    logEvent('info', `Post created: "${subject}" by ${userID.username}`, userID._id.toString());
    res.redirect("/index");

  } catch(error) {
    logEvent('error', `Post creation error: ${error.message}`, req.session.userInfo?._id?.toString());
    console.error("Error occurred during post creation.", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.post('/delete', async (req, res) => {
  try {
    const {keyMsg,keySubject} = req.body;

    if (!req.session.userInfo) {
      logEvent('warn', 'Unauthorized post deletion attempt');
      return res.redirect('/login');
    }

    const postsCollection = client.db("ForumsDB").collection("Posts");
    const result = await postsCollection.deleteOne({subject:keySubject,message:keyMsg});

    if (result.deletedCount === 1) {
      logEvent('info', `Post deleted: "${keySubject}" by ${req.session.userInfo.username}`, req.session.userInfo._id.toString());
      return res.redirect('/index');
    } else {
      logEvent('warn', `Post deletion failed: "${keySubject}"`, req.session.userInfo._id.toString());
      return res.status(404).json({ message: "Post not found or could not be deleted." });
    }
  } catch (error) {
    logEvent('error', `Post deletion error: ${error.message}`, req.session.userInfo?._id?.toString());
    console.error("Error occurred during post deletion:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/signup', (req, res) =>{
  logEvent('info', 'Signup page accessed');
  res.render("signup", { error: null });
});

// Handle registering users to the DB with enhanced validation
app.post('/signup', async (req, res) => {
  try {
      const { email, username, password, confirmpassword, securityQuestion, securityAnswer } = req.body;
      
      // Make sure all required fields are provided
      if (!email || !username || !password || !confirmpassword) {
          return res.render("signup", { 
            error: "All fields are required." 
          });
      }

      // Check if passwords match
      if (password !== confirmpassword) {
          return res.render("signup", { 
            error: "Passwords do not match." 
          });
      }

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
          return res.render("signup", { 
            error: passwordValidation.message 
          });
      }

      const usersCollection = client.db("ForumsDB").collection("Users");

      // Check if username already exists (case-insensitive)
      const existingUsername = await usersCollection.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
      
      if (existingUsername) {
          return res.render("signup", { 
            error: "Username already exists. Please choose a different username." 
          });
      }

      // Check if email already exists
      const existingEmail = await usersCollection.findOne({ email: email });
      
      if (existingEmail) {
          return res.render("signup", { 
            error: "Email address already registered. Please use a different email." 
          });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert the user data into the database
      const result = await usersCollection.insertOne({
          email: email,
          username: username,
          password: hashedPassword,
          profilePic: "https://news.tulane.edu/sites/default/files/headshot_icon_0.jpg",
          description: "",
          dlsuID: "",
          dlsuRole:  "member",
          gender: "",
          securityQuestion: securityQuestion || "What is your favorite color?",
          securityAnswer: securityAnswer || "",
          failedLoginAttempts: 0,
          passwordHistory: []  // Initialize empty password history
      });

      // If insertion is successful, respond with a success message
      if (result.insertedId) {
          return res.redirect('/login');
      } else {
          return res.render("signup", { 
            error: "Failed to create account. Please try again." 
          });
      }
  } catch (error) {
      console.error("Error occurred during signup:", error);
      return res.render("signup", { 
        error: "All fields are required." 
      });
    }

    if (password !== confirmpassword) {
      logEvent('warn', 'Signup attempt with mismatched passwords', null, userIP);
      return res.render("signup", { 
        error: "Passwords do not match." 
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      logEvent('warn', 'Signup attempt with weak password', null, userIP);
      return res.render("signup", { 
        error: passwordValidation.message 
      });
    }

    const usersCollection = client.db("ForumsDB").collection("Users");

    const existingUsername = await usersCollection.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    });
    
    if (existingUsername) {
      logEvent('warn', `Signup attempt with existing username: ${username}`, null, userIP);
      return res.render("signup", { 
        error: "Username already exists. Please choose a different username." 
      });
    }

    const existingEmail = await usersCollection.findOne({ email: email });
    
    if (existingEmail) {
      logEvent('warn', `Signup attempt with existing email: ${email}`, null, userIP);
      return res.render("signup", { 
        error: "Email address already registered. Please use a different email." 
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await usersCollection.insertOne({
      email: email,
      username: username,
      password: hashedPassword,
      profilePic: "https://news.tulane.edu/sites/default/files/headshot_icon_0.jpg",
      description: "",
      dlsuID: "",
      dlsuRole:  "member",
      gender: "",
      securityQuestion: securityQuestion || "What is your favorite color?",
      securityAnswer: securityAnswer || "",
      failedLoginAttempts: 0
    });

    if (result.insertedId) {
      logEvent('info', `New user registered: ${username}`, result.insertedId.toString(), userIP);
      return res.redirect('/login');
    } else {
      logEvent('error', 'User registration failed in database');
      return res.render("signup", { 
        error: "Failed to create account. Please try again." 
      });
    }
  } catch (error) {
    logEvent('error', `Signup error: ${error.message}`);
    console.error("Error occurred during signup:", error);
    return res.render("signup", { 
      error: "Internal server error. Please try again later." 
    });
  }
});

app.get('/editPost', (req, res) =>{
  logEvent('info', 'Edit post page accessed', req.session.userInfo?._id?.toString());
  res.render("editPost");
});

app.post('/editPost', async (req, res) => {
  try {
    const {curSubject,curMsg,subject, message, tag } = req.body;
    
    if (!req.session.userInfo) {
      logEvent('warn', 'Unauthorized post edit attempt');
      return res.redirect('/login');
    }

    if (!subject || !message || !tag) {
      logEvent('warn', 'Post edit with incomplete data', req.session.userInfo._id.toString());
      return res.status(400).json({ message: "Post ID, subject, and message are required." });
    }

    const postsCollection = client.db("ForumsDB").collection("Posts");
    const filter = {subject:curSubject,message:curMsg};
    const updates = {};

    if (subject) updates.subject = subject;
    if (message) updates.message = message;
    if (tag) updates.tag = tag;

    const result = await postsCollection.updateOne(filter,{$set:updates});

    if (result.modifiedCount === 1) {
      logEvent('info', `Post edited: "${curSubject}" -> "${subject}" by ${req.session.userInfo.username}`, req.session.userInfo._id.toString());
      return res.redirect('/index');
    } else {
      logEvent('warn', `Post edit failed: "${curSubject}"`, req.session.userInfo._id.toString());
      return res.status(404).json({ message: "Post not found or could not be updated." });
    }
  } catch (error) {
    logEvent('error', `Post edit error: ${error.message}`, req.session.userInfo?._id?.toString());
    console.error("Error occurred during post editing:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/editProfile', (req, res) =>{
  logEvent('info', 'Edit profile page accessed', req.session.userInfo?._id?.toString());
  res.render("editProfile");
});

app.get('/viewpost', (req, res) =>{
  logEvent('info', 'View post page accessed', req.session.userInfo?._id?.toString());
  res.render("viewpost");
});

app.post('/viewpost', (req, res) =>{
  logEvent('info', 'View post page accessed (POST)', req.session.userInfo?._id?.toString());
  res.render("viewpost");
});

app.get('/userPosts', (req, res) =>{
  logEvent('info', 'User posts page accessed', req.session.userInfo?._id?.toString());
  res.render("userPosts");
});

app.get('/userList', (req, res) =>{
  logEvent('info', 'User list page accessed', req.session.userInfo?._id?.toString());
  res.render("userList");
});

app.get("/userListData", async (req, res) => {
  try {
    const usersCollection = client.db("ForumsDB").collection("Users");
    const cursor = usersCollection.find();

    if ((await usersCollection.countDocuments()) === 0) {
      console.log("No documents found!");
    }

    const array =  await cursor.toArray();
    logEvent('info', 'User list data fetched', req.session.userInfo?._id?.toString());
    res.json(array);
  } catch (error) {
    logEvent('error', `Error fetching user list: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logs route - Admin only
app.get('/logs', async (req, res) => {
  if (!req.session.userInfo) {
    logEvent('warn', 'Unauthorized logs access attempt - not logged in');
    return res.redirect('/login');
  }

  // Check if user has admin role
  if (req.session.userInfo.dlsuRole !== 'admin') {
    logEvent('warn', `Non-admin user attempted to access logs: ${req.session.userInfo.username}`, req.session.userInfo._id.toString());
    return res.status(403).render('error', { 
      message: 'Access Denied', 
      error: 'You must be an administrator to view system logs.' 
    });
  }

  try {
    const logsCollection = client.db("ForumsDB").collection("Logs");
    
    const page = parseInt(req.query.page) || 1;
    const level = req.query.level || 'all';
    const date = req.query.date || '';
    const search = req.query.search || '';
    const limit = 20;
    
    let filter = {};
    
    if (level !== 'all') {
      filter.level = level;
    }
    
    if (date) {
      filter.timestamp = { $gte: new Date(date) };
    }
    
    if (search) {
      filter.message = { $regex: search, $options: 'i' };
    }
    
    const totalLogs = await logsCollection.countDocuments(filter);
    const totalPages = Math.ceil(totalLogs / limit);
    const skip = (page - 1) * limit;
    
    const logs = await logsCollection.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    logEvent('info', 'Logs page accessed by admin', req.session.userInfo._id.toString());
    res.render('logs', {
      logs: logs,
      currentPage: page,
      totalPages: totalPages
    });
    
  } catch (error) {
    logEvent('error', `Error fetching logs: ${error.message}`, req.session.userInfo._id.toString());
    res.status(500).render('logs', {
      logs: [],
      currentPage: 1,
      totalPages: 1,
      error: "Error loading logs"
    });
  }
});

