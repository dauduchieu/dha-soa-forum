const express = require("express")
const multer = require("multer");
const controller = require("./controller")
const sequelize = require("./configs/database")

const app = express()
const PORT = 3002

app.use(express.json())

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.post("/forum/posts", upload.array("files"), controller.newPost);
app.get("/forum/posts", controller.getPosts);
app.get("/forum/posts/:post_id", controller.getPostDetail);
app.put("/forum/posts/:post_id", upload.array("new_files"), controller.updatePost);
app.delete("/forum/posts/:post_id", controller.deletePost);
app.post("/forum/posts/:post_id/comments", upload.array("files"), controller.createComment);
app.get("/forum/posts/:post_id/comments", controller.getComments);
app.put("/forum/posts/:post_id/comments/:comment_id", upload.array("new_files"), controller.updateComment);
app.delete("/forum/posts/:post_id/comments/:comment_id", controller.deleteComment);

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ 
                message: "Payload Too Large: File size exceeds the limit (5MB)" 
            });
        }

        return res.status(400).json({ message: err.message });
    }

    if (err) {
        console.error("Internal Error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
    
    next();
});

app.listen(PORT, async () => {
    try {
        await sequelize.sync({ force: false });
        console.log("Database & tables created!");

        await controller.connectMQ();
        console.log("Connect MQ successfully!");

        controller.consumeSyncUserDB();
        controller.consumeAICommentResponse();
        console.log("✅ Listening for AI comment responses...");
    } catch(err) {
        console.error("Error creating:", err);
    }
})
