import express from 'express';
import path from 'path';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import loggerPkg from './logger.mjs';
const { initLogger, logEvent } = loggerPkg;


dotenv.config({ path: './secrets.env' });

const app = express();
const port = process.env.PORT || 3000;
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

// Connect to MongoDB and init logger
async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

// call connect & init logger
await connectToMongoDB();
initLogger(client);

// Express middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// session initialization (existing config preserved)
app.use(session({
  name: 'SessionCookie',
  genid: function(req) {
    return uuidv4();
  },
  secret: process.env.SESSION_SECRET || 'secretpass',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 3600 * 1000 }
}));

// serve static files
app.use('/', express.static('public', { index: "index" }));

// expose user to templates
app.use((req, res, next) => {
  if (req.session && req.session.userInfo) {
    res.locals.user = req.session.userInfo;
  } else {
    res.locals.user = null;
  }
  next();
});

// Request-audit middleware: lightweight trace for every request
app.use((req, res, next) => {
  try {
    const uid = req.session?.userInfo?._id?.toString() || null;
    // Avoid noisy logging for static assets by basic filter (optional)
    if (!req.originalUrl.startsWith('/public') && !req.originalUrl.startsWith('/favicon')) {
      logEvent(req, "debug", `Route accessed: ${req.method} ${req.originalUrl}`, uid);
    }
  } catch (e) {
    // Swallow any logging errors to avoid breaking requests
    console.error("Request-log middleware error", e);
  }
  next();
});

// view engine
app.set("view engine", "ejs");
app.set("views", "views");

app.use('/', express.static('public'))

app.get('/', (req, res) =>{

  res.render("login")

});

// global variable used in original file
var curUser = null;

// Root / index route
app.get('/index', (req, res) => {
  logEvent(req, 'info', 'Index page accessed', req.session.userInfo?._id?.toString());
  res.render("index");
});

// POSTS, COMMENTS, LIKES routes (with improved logging & error handling)

// GET posts
app.get('/posts', async (req, res) => {
  try {
    const postCollection = client.db("ForumsDB").collection("Posts");
    const cursor = postCollection.find();
    const array = await cursor.toArray();

    if (!array || array.length === 0) {
      logEvent(req, 'info', 'Posts endpoint returned zero documents', req.session.userInfo?._id?.toString());
    } else {
      logEvent(req, 'info', 'Posts fetched from database', req.session.userInfo?._id?.toString());
    }

    res.status(200).json(array);
  } catch (error) {
    logEvent(req, 'error', `Error fetching posts: ${error.message}`, req.session.userInfo?._id?.toString());
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET comments
app.get('/comments', async (req, res) => {
  try {
    const commCollection = client.db("ForumsDB").collection("Comments");
    const cursor = commCollection.find();
    const array = await cursor.toArray();

    if (!array || array.length === 0) {
      logEvent(req, 'info', 'Comments endpoint returned zero documents', req.session.userInfo?._id?.toString());
    } else {
      logEvent(req, 'info', 'Comments fetched from database', req.session.userInfo?._id?.toString());
    }

    res.status(200).json(array);
  } catch (error) {
    logEvent(req, 'error', `Error fetching comments: ${error.message}`, req.session.userInfo?._id?.toString());
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST comment
app.post('/postComment', async (req, res) => {
  try {
    const commentCollection = client.db("ForumsDB").collection("Comments");
    const date = new Date(Date.now()).toUTCString();
    const { comment, postID, authorID } = req.body;

    if (!req.session.userInfo) {
      logEvent(req, 'warn', 'Unauthorized comment attempt', null);
      return res.redirect('/login');
    }

    const result = await commentCollection.insertOne({
      comment: comment,
      date: date,
      authorID: authorID,
      postID: postID,
      dislikes: 0,
      likes: 0,
    });

    logEvent(req, 'info', `Comment posted on post ${postID} by user ${authorID}`, authorID);
    res.redirect("/viewpost?postID=" + postID);
  } catch (error) {
    logEvent(req, 'error', `Error posting comment: ${error.message}`, req.session.userInfo?._id?.toString());
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET likes
app.get('/likes', async (req, res) => {
  try {
    const likeCollection = client.db("ForumsDB").collection("Likes");
    const cursor = likeCollection.find();
    const array = await cursor.toArray();

    if (!array || array.length === 0) {
      logEvent(req, 'info', 'Likes endpoint returned zero documents', req.session.userInfo?._id?.toString());
    } else {
      logEvent(req, 'info', 'Likes data fetched', req.session.userInfo?._id?.toString());
    }

    res.status(200).json(array);
  } catch (error) {
    logEvent(req, 'error', `Error fetching likes: ${error.message}`, req.session.userInfo?._id?.toString());
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET like action (like/dislike)
app.get('/like', async (req, res) => {
  try {
    if (req.query.postID && req.session.userInfo) {
      const likeCollection = client.db("ForumsDB").collection("Likes");
      const postCollection = client.db("ForumsDB").collection("Posts");
      const commCollection = client.db("ForumsDB").collection("Comments");

      let likeValue = '1';
      const likerID = String(req.session.userInfo._id);
      const postID = req.query.postID;
      const postObjID = new ObjectId(postID);
      const postTarget = await postCollection.findOne({ _id: postObjID });

      if (req.query.likeValue) likeValue = req.query.likeValue;

      const filter = { likerID: likerID, postID: postID };
      const updates = { like: likeValue };

      await likeCollection.updateOne(filter, { $set: updates }, { upsert: true });

      const cursor = await likeCollection.find({ postID: postID });
      const likeArray = await cursor.toArray();

      if (postTarget) {
        await postCollection.updateOne({ _id: postObjID }, { $set: { likes: 0, dislikes: 0 } });

        let likes = 0;
        let dislikes = 0;
        likeArray.forEach((likeDocument) => {
          if (likeDocument.like == '1') likes++;
          else if (likeDocument.like == '-1') dislikes++;
        });

        const postCursor = await postCollection.findOneAndUpdate(
          { _id: postObjID },
          { $set: { likes, dislikes } },
          { returnDocument: 'after' }
        );

        const action = likeValue == '1' ? 'liked' : 'disliked';
        logEvent(req, 'info', `User ${action} post ${postID}`, likerID);
        return res.status(200).json(postCursor);
      } else {
        const commTarget = await commCollection.findOne({ _id: postObjID });
        if (commTarget) {
          await commCollection.updateOne({ _id: postObjID }, { $set: { likes: 0, dislikes: 0 } });
          likeArray.forEach((like) => {
            if (like.like == '1') commCollection.updateOne({ _id: postObjID }, { $inc: { likes: 1 } });
            else if (like.like == '-1') commCollection.updateOne({ _id: postObjID }, { $inc: { dislikes: 1 } });
          });
          logEvent(req, 'info', `User ${likerID} reacted to comment ${postID}`, likerID);
          return res.status(200).json({ message: "Comment reaction updated" });
        }
      }
    } else {
      logEvent(req, 'warn', 'Unauthorized like attempt', null);
      return res.status(404).json({ message: "Like request failed" });
    }
  } catch (error) {
    logEvent(req, 'error', `Error processing like: ${error.message}`, req.session.userInfo?._id?.toString());
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET updateLikes (recomputes likes/dislikes)
app.get('/updateLikes', async (req, res) => {
  try {
    if (req.query.postID) {
      const likeCollection = client.db("ForumsDB").collection("Likes");
      const postCollection = client.db("ForumsDB").collection("Posts");
      const commCollection = client.db("ForumsDB").collection("Comments");

      const postID = req.query.postID;
      const postObjID = new ObjectId(postID);
      let postTarget = await postCollection.findOne({ _id: postObjID });
      const cursor = likeCollection.find({ postID: postID });
      const likeArray = await cursor.toArray();

      if (postTarget) {
        await postCollection.updateOne({ _id: postObjID }, { $set: { likes: 0, dislikes: 0 } });
        likeArray.forEach((like) => {
          if (like.like == '1') postCollection.updateOne({ _id: postObjID }, { $inc: { likes: 1 } });
          else if (like.like == '-1') postCollection.updateOne({ _id: postObjID }, { $inc: { dislikes: 1 } });
        });
        logEvent(req, 'info', `Likes updated for post ${postID}`, req.session.userInfo?._id?.toString());
      } else {
        postTarget = await commCollection.findOne({ _id: postObjID });
        if (postTarget) {
          await commCollection.updateOne({ _id: postObjID }, { $set: { likes: 0, dislikes: 0 } });
          likeArray.forEach((like) => {
            if (like.like == '1') commCollection.updateOne({ _id: postObjID }, { $inc: { likes: 1 } });
            else if (like.like == '-1') commCollection.updateOne({ _id: postObjID }, { $inc: { dislikes: 1 } });
          });
          logEvent(req, 'info', `Likes updated for comment ${postID}`, req.session.userInfo?._id?.toString());
        }
      }
      return res.status(200).json({ message: "Likes updated" });
    } else {
      logEvent(req, 'warn', 'updateLikes called without postID', req.session.userInfo?._id?.toString());
      return res.status(400).json({ message: "postID required" });
    }
  } catch (error) {
    logEvent(req, 'error', `Error updating likes: ${error.message}`, req.session.userInfo?._id?.toString());
    return res.status(500).json({ message: "Internal server error" });
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

// LOGOUT
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
    console.error("Error occurred during editing of profile info", error);
    logEvent(req, 'error', `Error during profile edit: ${error.message}`, req.session.userInfo?._id?.toString());
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/userPosts', async (req, res) => {
  let userID = req.header('userID');

  if (userID) {
    try {
      const postCollection = client.db("ForumsDB").collection("Posts");
      const cursor = postCollection.find({ authorID: userID });
      const array = await cursor.toArray();

      logEvent(req, 'info', `User posts fetched for user ${userID}`, req.session.userInfo?._id?.toString());
      res.status(200).json(array);
    } catch (error) {
      logEvent(req, 'error', `Error locating user posts: ${error.message}`, req.session.userInfo?._id?.toString());
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    logEvent(req, 'warn', 'userPosts called without userID', req.session.userInfo?._id?.toString());
    res.status(400).json({ message: "userID header required" });
  }
});

// LOGIN / SIGNUP / FORGOT PASSWORD flows

app.get('/login', (req, res) => {
  logEvent(req, 'info', 'Login page accessed');
  res.render("login", { error: null });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userIP = req.ip || req.connection?.remoteAddress;

    if (!email || !password) {
      logEvent(req, 'warn', 'Login attempt with missing credentials', null);
      return res.render("login", { error: "Email and password are required." });
    }

    const usersCollection = client.db("ForumsDB").collection("Users");
    const user = await usersCollection.findOne({ email: email });

    if (!user) {
      logEvent(req, 'warn', `Failed login attempt for non-existent email: ${email}`, null);
      return res.render("login", { error: "Invalid email or password." });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000);
      logEvent(req, 'warn', `Login attempt on locked account: ${email}`, user._id.toString());
      return res.render("login", {
        error: `Account is locked. Please try again in ${remainingTime} seconds.`,
        lockout: true,
        remainingTime: remainingTime
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updates = { failedLoginAttempts: failedAttempts };

      if (failedAttempts >= 5) {
        updates.lockUntil = Date.now() + 30000;
        updates.failedLoginAttempts = 0;
        await usersCollection.updateOne({ email: email }, { $set: updates });

        logEvent(req, 'warn', `Account locked due to too many failed attempts: ${email}`, user._id.toString());
        return res.render("login", {
          error: "Too many failed login attempts. Account locked for 30 seconds.",
          lockout: true,
          remainingTime: 30
        });
      }

      await usersCollection.updateOne({ email: email }, { $set: updates });

      const attemptsLeft = 5 - failedAttempts;
      logEvent(req, 'warn', `Failed login attempt for user: ${user.username} (${attemptsLeft} attempts left)`, user._id.toString());
      return res.render("login", {
        error: `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`,
        attemptsLeft: attemptsLeft
      });
    }

    // Successful login
    await usersCollection.updateOne(
      { email: email },
      {
        $set: { failedLoginAttempts: 0 },
        $unset: { lockUntil: "" }
      }
    );

    req.session.userInfo = user;

    logEvent('info', `User logged in successfully: ${user.username}`, user._id.toString(), userIP);
    return res.redirect('/index');

  } catch (error) {
    logEvent(req, 'error', `Login error: ${error.message}`);
    console.error("Error occurred during login:", error);
    return res.render("login", { error: "Internal server error." });
  }
});

app.get('/forgot-password', (req, res) => {
  logEvent(req, 'info', 'Forgot password page accessed');
  res.render("forgot-password", { step: 1, error: null });
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { email, securityAnswer, newPassword, confirmPassword } = req.body;
    const usersCollection = client.db("ForumsDB").collection("Users");

    if (email && !securityAnswer) {
      const user = await usersCollection.findOne({ email: email });
      if (!user) {
        logEvent(req, 'warn', `Password reset attempt for non-existent email: ${email}`);
        return res.render("forgot-password", { step: 1, error: "Email address not found." });
      }

      if (!user.securityQuestion || !user.securityAnswer) {
        logEvent(req, 'warn', `Password reset attempt for account without security question: ${email}`, user._id?.toString());
        return res.render("forgot-password", { step: 1, error: "No security question set for this account. Please contact support." });
      }

      logEvent(req, 'info', `Password reset initiated for: ${email}`, user._id.toString());
      return res.render("forgot-password", { step: 2, email: email, securityQuestion: user.securityQuestion, error: null });
    }

    if (email && securityAnswer && newPassword) {
      const user = await usersCollection.findOne({ email: email });
      if (!user) {
        return res.render("forgot-password", { step: 1, error: "Email address not found." });
      }

      if (user.securityAnswer.toLowerCase() !== securityAnswer.toLowerCase()) {
        logEvent(req, 'warn', `Incorrect security answer for password reset: ${email}`, user._id.toString());
        return res.render("forgot-password", { step: 2, email: email, securityQuestion: user.securityQuestion, error: "Incorrect answer to security question." });
      }

      if (newPassword !== confirmPassword) {
        return res.render("forgot-password", { step: 2, email: email, securityQuestion: user.securityQuestion, error: "Passwords do not match." });
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.render("forgot-password", { step: 2, email: email, securityQuestion: user.securityQuestion, error: passwordValidation.message });
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

      logEvent(req, 'info', `Password reset successful for: ${email}`, user._id.toString());
      return res.render("forgot-password", { step: 3, success: true, error: null });
    }

  } catch (error) {
    logEvent(req, 'error', `Password reset error: ${error.message}`);
    console.error("Error during password reset:", error);
    return res.render("forgot-password", { step: 1, error: "Internal server error." });
  }
});

// Password validation (copied from original)
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < minLength) {
    return { isValid: false, message: `Password must be at least ${minLength} characters long.` };
  }
  if (!hasUpperCase) {
    return { isValid: false, message: "Password must contain at least one uppercase letter." };
  }
  if (!hasNumber) {
    return { isValid: false, message: "Password must contain at least one number." };
  }
  if (!hasSpecialChar) {
    return { isValid: false, message: "Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)" };
  }
  return { isValid: true, message: "Password is valid." };
}

// userData route
app.get('/userData', async (req, res) => {
  let userID = req.header('userID');

  try {
    if (userID === null || userID === "null") {
      userID = req.session.userInfo?._id;
      if (!userID) {
        logEvent(req, 'warn', 'Unauthorized user data access attempt');
        return res.status(401).json({ message: "No logged in user found", status: 401 });
      }
    }

    const usersCollection = client.db("ForumsDB").collection("Users");
    const userToSend = await usersCollection.findOne({ _id: new ObjectId(userID) });

    if (!userToSend) {
      logEvent(req, 'warn', `User data not found for ID: ${userID}`);
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

    logEvent(req, 'info', `User data fetched for: ${userToSend.username}`, userID.toString());
    res.json(userData);
  } catch (error) {
    logEvent(req, 'error', `Error locating user: ${error.message}`);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Profile view & create post routes
app.get('/profile', (req, res) => {
  logEvent(req, 'info', 'Profile page accessed', req.session.userInfo?._id?.toString());
  res.render("profile");
});

app.get('/create', (req, res) => {
  logEvent(req, 'info', 'Create post page accessed', req.session.userInfo?._id?.toString());
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

    logEvent(req, 'info', `Post created: "${subject}" by ${userID.username}`, userID._id.toString());
    res.redirect("/index");

  } catch (error) {
    logEvent(req, 'error', `Post creation error: ${error.message}`, req.session.userInfo?._id?.toString());
    console.error("Error occurred during post creation.", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// POST delete post
app.post('/deletePost', async (req, res) => {
  try {
    const { keyMsg, keySubject } = req.body;

    if (!req.session.userInfo) {
      logEvent(req, 'warn', 'Unauthorized post deletion attempt');
      return res.redirect('/login');
    }

    const postsCollection = client.db("ForumsDB").collection("Posts");
    const result = await postsCollection.deleteOne({ subject: keySubject, message: keyMsg });

    if (result.deletedCount === 1) {
      logEvent(req, 'info', `Post deleted: "${keySubject}" by ${req.session.userInfo.username}`, req.session.userInfo._id.toString());
      return res.redirect('/index');
    } else {
      logEvent(req, 'warn', `Post deletion failed: "${keySubject}"`, req.session.userInfo._id.toString());
      return res.status(404).json({ message: "Post not found or could not be deleted." });
    }
  } catch (error) {
    logEvent(req, 'error', `Post deletion error: ${error.message}`, req.session.userInfo?._id?.toString());
    console.error("Error occurred during post deletion:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Signup and edit post/profile routes and logs page (admin)
app.get('/signup', (req, res) => {
  logEvent(req, 'info', 'Signup page accessed');
  res.render("signup", { error: null });
});

app.post('/signup', async (req, res) => {
  try {
    const { email, username, password, confirmpassword, securityQuestion, securityAnswer } = req.body;

    // Make sure all required fields are provided
    if (!email || !username || !password || !confirmpassword) {
      logEvent(req, 'warn', 'Signup attempt with missing fields', null);
      return res.render("signup", { error: "All fields are required." });
    }

    // Check if passwords match
    if (password !== confirmpassword) {
      logEvent(req, 'warn', 'Signup attempt with mismatched passwords', null);
      return res.render("signup", { error: "Passwords do not match." });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      logEvent(req, 'warn', 'Signup attempt with weak password', null);
      return res.render("signup", { error: passwordValidation.message });
    }

    const usersCollection = client.db("ForumsDB").collection("Users");

    // Check if username already exists (case-insensitive)
    const existingUsername = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });
    if (existingUsername) {
      logEvent(req, 'warn', `Signup attempt with existing username: ${username}`, null);
      return res.render("signup", { error: "Username already exists. Please choose a different username." });
    }

    // Check if email already exists
    const existingEmail = await usersCollection.findOne({ email: email });
    if (existingEmail) {
      logEvent(req, 'warn', `Signup attempt with existing email: ${email}`, null);
      return res.render("signup", { error: "Email address already registered. Please use a different email." });
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
      dlsuRole: "member",
      gender: "",
      securityQuestion: securityQuestion || "What is your favorite color?",
      securityAnswer: securityAnswer || "",
      failedLoginAttempts: 0,
      passwordHistory: []
    });

    if (result.insertedId) {
      logEvent(req, 'info', `New user registered: ${username}`, result.insertedId.toString());
      return res.redirect('/login');
    } else {
      logEvent(req, 'error', 'User registration failed in database');
      return res.render("signup", { error: "Failed to create account. Please try again." });
    }

  } catch (error) {
    logEvent(req, 'error', `Signup error: ${error.message}`);
    console.error("Error occurred during signup:", error);
    return res.render("signup", { error: "Internal server error. Please try again later." });
  }
});

app.get('/editPost', (req, res) => {
  logEvent(req, 'info', 'Edit post page accessed', req.session.userInfo?._id?.toString());
  res.render("editPost");
});

app.post('/editPost', async (req, res) => {
  try {
    const { curSubject, curMsg, subject, message, tag } = req.body;

    if (!req.session.userInfo) {
      logEvent(req, 'warn', 'Unauthorized post edit attempt');
      return res.redirect('/login');
    }

    if (!subject || !message || !tag) {
      logEvent(req, 'warn', 'Post edit with incomplete data', req.session.userInfo._id.toString());
      return res.status(400).json({ message: "Post ID, subject, and message are required." });
    }

    const postsCollection = client.db("ForumsDB").collection("Posts");
    const filter = { subject: curSubject, message: curMsg };
    const updates = {};

    if (subject) updates.subject = subject;
    if (message) updates.message = message;
    if (tag) updates.tag = tag;

    const result = await postsCollection.updateOne(filter, { $set: updates });

    if (result.modifiedCount === 1) {
      logEvent(req, 'info', `Post edited: "${curSubject}" -> "${subject}" by ${req.session.userInfo.username}`, req.session.userInfo._id.toString());
      return res.redirect('/index');
    } else {
      logEvent(req, 'warn', `Post edit failed: "${curSubject}"`, req.session.userInfo._id.toString());
      return res.status(404).json({ message: "Post not found or could not be updated." });
    }
  } catch (error) {
    logEvent(req, 'error', `Post edit error: ${error.message}`, req.session.userInfo?._id?.toString());
    console.error("Error occurred during post editing:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/editProfile', (req, res) => {
  logEvent(req, 'info', 'Edit profile page accessed', req.session.userInfo?._id?.toString());
  res.render("editProfile");
});

app.get('/viewpost', (req, res) => {
  logEvent(req, 'info', 'View post page accessed', req.session.userInfo?._id?.toString());
  res.render("viewpost");
});

app.post('/viewpost', (req, res) => {
  logEvent(req, 'info', 'View post page accessed (POST)', req.session.userInfo?._id?.toString());
  res.render("viewpost");
});

app.get('/userList', (req, res) => {
  logEvent(req, 'info', 'User list page accessed', req.session.userInfo?._id?.toString());
  res.render("userList");
});

app.get("/userListData", async (req, res) => {
  try {
    const usersCollection = client.db("ForumsDB").collection("Users");
    const cursor = usersCollection.find();
    const array = await cursor.toArray();

    logEvent(req, 'info', 'User list data fetched', req.session.userInfo?._id?.toString());
    res.json(array);
  } catch (error) {
    logEvent(req, 'error', `Error fetching user list: ${error.message}`, req.session.userInfo?._id?.toString());
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logs route - Admin only
app.get('/logs', async (req, res) => {
  if (!req.session.userInfo) {
    logEvent(req, 'warn', 'Unauthorized logs access attempt - not logged in');
    return res.redirect('/login');
  }

  if (req.session.userInfo.dlsuRole !== 'admin') {
    logEvent(req, 'warn', `Non-admin user attempted to access logs: ${req.session.userInfo.username}`, req.session.userInfo._id.toString());
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

    if (level !== 'all') filter.level = level;
    if (date) filter.timestamp = { $gte: new Date(date) };
    if (search) filter.message = { $regex: search, $options: 'i' };

    const totalLogs = await logsCollection.countDocuments(filter);
    const totalPages = Math.ceil(totalLogs / limit);
    const skip = (page - 1) * limit;

    const logs = await logsCollection.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    logEvent(req, 'info', 'Logs page accessed by admin', req.session.userInfo._id.toString());
    res.render('logs', {
      logs: logs,
      currentPage: page,
      totalPages: totalPages
    });

  } catch (error) {
    logEvent(req, 'error', `Error fetching logs: ${error.message}`, req.session.userInfo._id?.toString());
    res.status(500).render('logs', {
      logs: [],
      currentPage: 1,
      totalPages: 1,
      error: "Error loading logs"
    });
  }
});

// global uncaught exception handlers (non-fatal to app if logger fails)
process.on("unhandledRejection", err => {
  try { logEvent(null, "error", "Unhandled Promise Rejection: " + (err?.message || err)); } catch (e) { console.error("Logger failed in unhandledRejection", e); }
});
process.on("uncaughtException", err => {
  try { logEvent(null, "error", "Uncaught Exception: " + (err?.message || err)); } catch (e) { console.error("Logger failed in uncaughtException", e); }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  // Log starting event with system route
  try { logEvent(null, 'info', `Server started on port ${port}`); } catch (e) { console.error(e); }
});