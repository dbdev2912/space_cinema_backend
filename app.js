const express = require('express');

const secret = require('./secret');
const { connector } = require('./templates/db/connector.js');

const app = express()


/* middlewares */

app.use(require('body-parser')());
app.use(require('cookie-parser')(secret.cookie));
app.use(require('express-session')());
app.use(express.json());

app.use( express.static('public') );
/* GET routing */
app.get('/', (req, res) => {
    res.send({ msg: "Hello World" });
})

app.get('/data', (req, res)=>{

});

/* POST routing */

app.post('/api/login', (req, res)=>{
    const { username, password } = req.body;

    connector( (dbo) => {
        dbo.collection('accounts').findOne({ username, password } ,(err, result)=>{
            const user = result;
            const response = {
                success: false,
                location: "/login",
            }
            if( user ){
                response.success = true;
                switch (user.role) {
                    case "admin":
                        response.location = "/admin";
                        req.session.admin = user;
                        break;
                    case "staff":
                        response.location = "/staff";
                        req.session.staff = user;
                        break;
                    default:
                        response.location = "/";
                        req.session.user = user;
                        break;
                }
            }
            res.send(response)
        });
    });
});


/* final middlewares */

app.use((req, res, next) => {
    res.send(404, { msg: "404 not found" });
})

app.listen(5000, ()=>{
    console.log("Server running on www://ws:5000");
});
