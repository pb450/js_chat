const express = require('express');
const app = express();
const sqlite = require('sqlite3');
const crypto = require('crypto');
const rndstr = require('randomstring')
const session = require('express-session')
const multer = require('multer')
const fs = require('fs')

app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/static"))
app.use(express.urlencoded({extended:true}))

app.use(session({
    genid: function(req) {
      return rndstr.generate(16);
    },
    secret: '39CEC59277367DD676D17425C1AB8'
}))
//Secret above is test secret, you propably want to change it

var db = new sqlite.Database('db/chatdb.db', (err) => {
    if (err) {
        console.log(err);
    }
    console.log('Connected to DB!')
})

var storageSpace = multer.diskStorage({
    destination: './uploads/'
})

var upload = multer({
    storage: storageSpace,
    limits: {fileSize: 8000000}
}).single("uploaded_file");

/* UTILITIES */

process.on('SIGTERM', () => {
    db.close();
    console.log('Shutdown');
    process.exit(0);
});

function ThrowError(response, content) {
    response.render('error', error_content= { ctx : content })
}

/* APP GET/POST/ETC */

app.get('/chat', (req, res) => {
    if (!req.session.current_user) {
        ThrowError(res, "You are not logged in!");
        return;
    }

    res.render('main');
});

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/register', (req, res) => {
    var username = req.body.register_username;
    var email = req.body.register_mail
    var password = req.body.register_password

    if (!username || !email || !password) {
        ThrowError(res, "No username or email or password provided");
        return;
    }

    db.get('SELECT COUNT(*) c FROM chat_user WHERE user_name = ? OR email = ?', [username, email], (err, row) => {
        if (err) throw err;

        if (row.c == 0) {

            var id_256 = rndstr.generate(256);
            var id_128 = rndstr.generate(128);
            var id_64 = rndstr.generate(8);
            var passwd_hash = crypto.createHash('sha256').update(password).digest('hex');
            var mail = email;
            var img = rndstr.generate(10);

            db.run('INSERT INTO chat_user VALUES (?, ?, ?, ?, ?, ?, ?)', [id_256, id_128, id_64, passwd_hash, username, mail, img], (err) => {
                if (err) {
                    console.log(err);
                }
            });

            res.render('regsu');
        } else {
            ThrowError(res, "User or email already exists")
        }
    })

    
});

app.post("/login", (req, res) => {
    var username = req.body.login_username;
    var password = req.body.login_pass;
    var pwd_hash = crypto.createHash('sha256').update(password).digest('hex');

    if (!username || !password) {
        ThrowError(res, "No password or login given");
        return;
    }

    db.get('SELECT id FROM chat_user WHERE user_name = ? AND login_secret = ?', [username, pwd_hash], (err, row) => {
        if (err) throw err;
        if (row) {
            req.session.current_user = row.id;
            res.redirect('chat');
        } else {
            ThrowError(res, "Invalid login or password");
        }
    });
});

app.post("/logout", (req, res) => {
    if (!req.session.current_user) {
        ThrowError(res, "You are not logged in order to log out");
        return;
    }

    req.session.destroy((err) => {

        console.log('Destroy req.session')
        if (err) {
            console.log(err);
        } else {
            res.status(200).redirect('/');
        }
    });
});

app.post('/getConversation', (req, res) => {

    var idOfCOnv = req.body.id;
    if (!idOfCOnv) {
        res.json({"error":"no_id"});
        return;
    }

    var after = req.query.after;
    var isAfter = true;
    if (!after) {
        isAfter = false;
    }

    db.get('SELECT COUNT(*) c FROM conversation WHERE chat_user_id = ? AND id = ?', [req.session.current_user, idOfCOnv], (err, row) => {
        if (err) throw err;
        if (row.c > 0) {


            retObj = {
                "messages": []
            };
            
            //var query_for_users = 'SELECT id a_id, content a_ctx, sending_date a_sdx, sender a_snd from message WHERE conversation = ?' + (!isAfter ? ' ' : ' AND a_sdx > ' + after + ' ') + 'ORDER BY sending_date DESC;'
            var query_for_users = 'SELECT m.id a_id, m.content a_ctx, m.sending_date a_sdx, m.sender a_snd, m.type a_tp, f.filename fn from message m LEFT JOIN file f ON f.id = m.content WHERE m.conversation = ?' + (!isAfter ? ' ' : ' AND a_sdx > ' + after + ' ') + 'ORDER BY m.sending_date DESC;'

            db.all(query_for_users, [idOfCOnv], (err, rows) => {
                if (err) throw err;
                
                rows.forEach(x => {
                    var mode = x.a_snd == req.session.current_user;
                    //var n_b = {"id" : x.a_id, "cyx" : x.a_ctx, "date": x.a_sdx, "sender": x.a_snd, "mode": mode};

                    var type = x.a_tp;
                    var n_b = {"id" : x.a_id, "date": x.a_sdx, "sender": x.a_snd, "mode": mode, "type": type}
                    
                    if (type == 'text') {
                        n_b["ctx"] = x.a_ctx;
                    } else {
                        n_b["file"] = {"id" : x.a_ctx, "filename" : x.fn};
                    }

                    retObj.messages.push(n_b);
                })

                res.json(retObj);
            });
        } else {
            res.json({"error":"no_conv"});
            return;
        }
    });
});

app.post('/upload', upload, (req, res, next) => {


    if (!req.session.current_user) {
        res.json({'status' : 'no_login'});
        return;
    }

    console.log(req.body);
    if (!req.body.conv) {
        res.json({'status' : 'no_conv'});
        return;
    }

    if (!req.file) {
        console.log(err);
        res.json({'status' : 'no_file'});
        return;
    }

    console.log(req.file);
    var id = req.file.filename;
    var org = req.file.originalname;
    var conv = req.body.conv;

    db.run('INSERT INTO file VALUES (?, ?)', [id, org], (err) => {
        if (err) {
            console.log(err);
            res.json({'status' : err});
            return;
        }

        db.get('SELECT COUNT(*) c FROM conversation WHERE chat_user_id = ? AND id = ?', [req.session.current_user, conv], (err, row) => {
            if (err) throw err;
            if (row.c > 0) {
                InsertNewMessage(req, res, id, conv, 'file');
                res.json({"status":'ok'});
                return;
            } else {
                res.json({"status":'no_matching_conv'});
                return;
            }
        });
    });
    
});

app.post('/sendMessage', (req, res) => {

    if (!req.session.current_user) {
        ThrowError(res, "You are not logged in");
        return;
    }

    var conv = req.body.conv;
    var content = req.body.content;

    if (!conv || !content) {
        //ThrowError(res, "No required fields (conversation or content)");
        res.json({"status":'no_conv_or_ctx_or_ctxtype'});
        return;
    }

    db.get('SELECT COUNT(*) c FROM conversation WHERE chat_user_id = ? AND id = ?', [req.session.current_user, conv], (err, row) => {
        if (err) throw err;
        if (row.c > 0) {
            InsertNewMessage(req, res, content, conv, 'text');
            res.json({"status":'ok'});
        } else {
            res.json({"status":'no_matching_conv'});
            return;
        }
    });
});

function InsertNewMessage(req, res, content, conv, TYPE) {
    var new_msg_id = rndstr.generate(128);
    var ctx = content;
    var unix_time = Math.floor(Date.now() / 1000);
    var sender = req.session.current_user;
    var cov = conv;

    var FILLOUT = '';
    db.run('INSERT INTO message (id, content, sending_date, sender, conversation, conversation_id, type, chat_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [new_msg_id, ctx, unix_time, sender, cov, FILLOUT, TYPE, FILLOUT], (err) => {
        if (err) throw err;
    });
}

app.get('/getData', (req, res) => {
    if (!req.session.current_user) {
        res.json({"error": "no_login"});
        return;
    }
    else {

        var retObj = {
            account: {
                username: "",
                img: "",
                id_3: ""
            }, 
            convs: []
        }

        db.get('SELECT user_name, img, id_3 FROM chat_user WHERE id = ?', [req.session.current_user], (err, row) => {
            if (err) throw err;
            retObj.account.username = row.user_name;
            retObj.account.img = row.img;
            retObj.account.id_3 = row.id_3;


            var query_for_users = `SELECT c.id as cid, u.user_name as name, u.img FROM conversation c
            JOIN chat_user u ON c.chat_user_id = u.id
            WHERE c.id in
            (SELECT cx.id FROM conversation cx WHERE cx.chat_user_id = ?)
            AND c.chat_user_id != ?;`

            db.all(query_for_users, [req.session.current_user, req.session.current_user], (err, rows) => {
                if (err) throw err;

                //console.log(rows);
                rows.forEach(x => {
                    var n_b = {"name" : x.name, "img" : x.img, "conv": x.cid};
                    retObj.convs.push(n_b);
                })

                res.json(retObj);
            });

            //res.json(retObj);
        });
    }

});

app.post("/addContact", (req, res) => {

    if (!req.session.current_user) {
        ThrowError(res, "You are not logged in");
        return;
    }

    var code = req.body.add_contact_code;
    if (!code) {
        ThrowError(res, "Code text is empty");
    } else {
        db.get('SELECT id FROM chat_user WHERE id_3 = ?', [code], (err, row) => {
            if (!row) {
                ThrowError(res, "This user do not exist");
            } else {
                var codes = [req.session.current_user, row.id];

                var new_conv_code = rndstr.generate(64);

                codes.forEach(element => {
                    db.run('INSERT INTO conversation (id, chat_user_id) VALUES (?, ?)', [new_conv_code, element], (err) => {
                        if (err) throw err;
                    });
                });

                res.send("ok");
            }
        });
    }
});

app.get('/download', (req, res) => {
    if (!req.query.id) {
        res.json({"status":'no_id'});
        return;
    }

    var id = req.query.id;

    db.get('SELECT f.filename fi  FROM file f WHERE id = ?', [id], (err, row) => {
        if (err) {
            throw err;
        }

        if (!row) {
            res.json({"status":'no_file'});
            return;
        }

        var file = fs.createReadStream('./uploads/' + id);
        var filename = row.fi;

        console.log(filename);
        res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"')
        file.pipe(res)
    });
});


app.listen(3000, function() {
    console.log('Listening on port 3000!');
})