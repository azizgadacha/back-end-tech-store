const Workspace =require('../model/workspace');
const mongoose = require("mongoose");
const Widget = require("../model/Widget");
const data = require("../model/data");
const notification = require("../model/notification");
const User = require("../model/user");
const activeSession = require("../model/activeSession");
const fs = require("fs");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const Joi = require("joi");
const jwt = require("jsonwebtoken");



//delete user

exports.DeleteUser=async (req, res) => {

    let id = req.body.userDeleted_id;
    var descendants = []
    var Workspaceitems = []
    User.findOneAndDelete({_id: id}).then(async (user) => {

        if (user) {
            await notification.deleteMany({$or:[{receiver: user._id},{idNotified: user._id},{sender: user._id}]})

            Workspace.updateMany({Share:{ $elemMatch : { sharedWith:user._id }}}, {$pull: {Share: {sharedWith:user._id}}})

            //descendants.push(id)
            var items = await Workspace.find({superior_id: id})

            for (let item of items) {
                descendants.push(item._id)

                var stack = [];
                stack.push(item);
                Workspaceitems.push(item)
                while (stack.length > 0) {
                    var currentnode = stack.pop();

                    var children = await Workspace.find({superior_id: currentnode._id});

                    children.forEach(function (child) {
                        descendants.push(child._id);
                        Workspaceitems.push(child)
                        stack.push(child);
                    });
                }
                descendants.join(",")
                for (item of descendants) {
                    await Workspace.findByIdAndRemove(item.toString())

                }


            }
            activeSession.deleteMany({userId: id})
                .then((AS) => {

                })
            Workspace.updateMany ({},{$pull:{share:{sharedWith:id}} })
                .then((AS) => {

                })





            User.password = undefined;
            let usertable = user

            if (fs.existsSync('./upload/' + user.photo) && (user.photo != 'avatar_1.png')) {

                if (user.photo)
                    fs.unlinkSync("./upload/" + user.photo)
            }


            res.json({success: true, msg: "User has been deleted ", user: usertable});

        }
        else {
            res.json({success: false, msg: "error  user dosn't excite "});
        }
    })}

//edit password

exports.editPass=(req, res) => {
    const { userID,newPassword,oldPassword } = req.body;

    User.findOne({ _id: userID }).then((user) => {
        if (user) {

            const query = { _id: user._id };


            bcrypt.compare(oldPassword, user.password, async (_err2, isMatch) => {



                if (isMatch) {

                    bcrypt.genSalt(10, (_err, salt) => {
                        bcrypt.hash(newPassword, salt).then((hash) => {
                            User.findOneAndUpdate(query, {password:hash}).then(
                                (user1) => {
                                    user1.password = undefined;
                                    return res.json({ success: true,passprob:false,user:user1 })
                                }
                            ).catch(() => {
                                return  res.json({ success: false, passprob:false, msg: 'There was an error. Please contract the administrator' });
                            });
                        });
                    });
                }else {

                    return res.json({success: false, passprob: true, msg: 'Wrong credentials'});
                }}



            );


        } else {

            return  res.json({ success: false,passprob:false, msg: "User didn't excite" });
        }
    }).catch(()=>{

        return  res.json({ success: false,passprob:false, msg: "User didn't excite" })
    })
}

//edit role
exports.editRole=(req, res) => {
    const { userID,role } = req.body;

    User.findOneAndUpdate({ _id: userID },{role}).then((userUpdated) => {
        if (userUpdated){

            Workspace.updateMany({Share:{ $elemMatch : { sharedWith:userID }}}, {$pull: {Share: {sharedWith:userID}}})

                .then(async (AS) => {
                    await notification.deleteMany({$or: [{receiver: userID}]})

                    userUpdated.password = undefined

                    userUpdated.role = role
                    res.json({success: true, user: userUpdated})
                })

        }
        else
            res.json({ success: false, })



    })


}
//edit User

exports.edituser=(req, res) => {
    const { id,username, email,password,phone } = req.body;



    User.findOne({ _id: id }).then((user) => {
        if (user) {
            const query = { _id: user._id };

            bcrypt.compare(password, user.password, async (_err2, isMatch) => {
                let newvalues ;

                if (isMatch) {
                    if (req.body.sendPhoto==='true')
                    {
                        if (fs.existsSync('./upload/' + user.photo) && (user.photo != 'avatar_1.png')) {

                            if (user.photo)
                                fs.unlinkSync("./upload/" + user.photo)
                        }
                        var  file=req.file.filename

                        newvalues = { username:username.toLowerCase(), email:email.toLowerCase(),phone,photo:file }

                    }
                    else
                        newvalues = { username:username.toLowerCase(), email:email.toLowerCase(),phone}






                    User. findOneAndUpdate(query, newvalues).then(
                        (user) => {

                            User.findOne(query).then((use)=>{

                                use.password = undefined;

                                return res.json({ success: true,passprob:false,user:use });}

                            )


                        }
                    ).catch(() => {
                        return  res.json({ success: false, passprob:false, msg: 'There was an error. Please contact the administrator' });
                    });



                }else {

                    return res.json({success: false, passprob: true, msg: 'Wrong credentials'});
                }});


        } else {

            return  res.json({ success: false,passprob:false, msg: "User didn't excite" });
        }
    })


}
//get all

exports.getall=(req, res) => {

    let  id=req.body. user_id
    let filter


    if(req.body.email){

        filter={$or: [ {email:req.body.email.toLowerCase(), _id: { $nin: `${id}` } }, {  _id: { $nin: `${id}` },username:req.body.username.toLowerCase()},{  _id: { $nin: `${id}` },phone:req.body.phone}]}


    }else{
        filter=   { _id: { $nin: `${id}` } }
    }


    User.find(  filter).then((users) => {


        users = users.map((item) => {
            const x = item;
            x.password = undefined;
            return x;
        });
        res.json({ success: true, users });

    }).catch((e) =>
    {
        res.json({ success: false })})





    ;
}

// login

exports.login=(req, res) => {

    // Joy Validation

    const userSchema = Joi.object().keys({

        email: Joi.string().email().required(),

        password: Joi.string().required(),
    });
    const result = userSchema.validate(req.body);
    if (result.error) {
        res.status(422).json({
            success: false,
            msg: `Validation err: ${result.error.details[0].message}`,
        });
        return;
    }

    const { email } = req.body;
    const { password } = req.body;

    User.findOne({ email }            ).then((user) => {
        if (!user) {
            return res.json({ success: false, msg: 'Wrong credentials' });
        }

        if (!user.password) {
            return res.json({ success: false, msg: 'No password' });
        }

        bcrypt.compare(password, user.password, async (_err2, isMatch) => {
            if (isMatch) {
                if (!process.env.SECRET) {
                    throw new Error('SECRET not provided');
                }

                const token = jwt.sign({
                    id: user._id,
                    username: user.username,
                    email: user.email,
                }, process.env.SECRET, {
                    expiresIn: 10860400, // 1 week
                });


                const query = {userId: user.id, token};

                await activeSession.create(query);
                // Delete the password (hash)
                user.password = undefined;
                return res.json({
                    success: true,
                    token,
                    user,
                });
            }
            return res.json({success: false, msg: 'Wrong credentials'});
        });
    });
}

// logOut

exports.logout=(req, res) => {
    const { token } = req.body;

    activeSession.findOneAndDelete({ token })
        .then(() => res.json({ success: true }))
        .catch(() => {
            res.json({ success: false, msg: 'Token revoked' });
        });
}

//Registre
exports.registre=async (req,res) => {

    let   valid={email:req.body.email,username:req.body.username,phone:req.body.phone,role:req.body.role}

    const userSchema = Joi.object().keys({

        email: Joi.string().email().required(),
        username: Joi.string().allow(" ") .min(4).max(15)
            .optional().required(),
        phone: Joi.number().required(),

        role:Joi.string().required()
    });
    const result = userSchema.validate(valid);
    if (result.error) {
        res.status(422).json({
            success: false,
            msg: `Validation err: ${result.error.details[0].message}`,
        });
        return;
    }

    const {username, email,phone,role} = req.body;

    let  file=null


    if (req.body.sendtphoto==='true')
    {
        file=req.file.filename
    }else{

        file="avatar_1.png"

    }

    User.findOne({ $or: [{ email:email.toLowerCase() }, { username:username.toLowerCase() },{phone}]}).then((user) => {
        if (user) {

            res.json({success: false, msg: `  a user with same ${ user.email==email.toLowerCase()?'email':user.username==username.toLowerCase()?'username':'phone'} already exist `});
        } else {
            //  if(!file)
            //  {
            // }


            let  password=Math.random().toString(36).slice(-8);
            bcrypt.genSalt(10, (_err, salt) => {
                bcrypt.hash(password, salt).then(async (hash) => {
                    const query = {
                        username:username.toLowerCase(),
                        email:email.toLowerCase(),
                        password: hash,
                        phone,
                        role,
                        photo: file

                    };

                    try {

                        let transporter = nodemailer.createTransport({
                            service: 'gmail',
                            secureConnection:false,
                            port :587,
                            tls:{
                                ciphers:'SSLv3'
                            },
                            auth: {
                                user: process.env.EMAIL,
                                pass: process.env.PASSWORD
                            }
                        })


                        await transporter.sendMail({
                            from: process.env.EMAIL,

                            to: email.toLowerCase(),

                            subject: "Account creation in PERSOSPACE",
                            html: `


<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="format-detection" content="telephone=no"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>information</title><style type="text/css" emogrify="no">#outlook a { padding:0; } .ExternalClass { width:100%; } .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; } table td { border-collapse: collapse; mso-line-height-rule: exactly; } .editable.image { font-size: 0 !important; line-height: 0 !important; } .nl2go_preheader { display: none !important; mso-hide:all !important; mso-line-height-rule: exactly; visibility: hidden !important; line-height: 0px !important; font-size: 0px !important; } body { width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; margin:0; padding:0; } img { outline:none; text-decoration:none; -ms-interpolation-mode: bicubic; } a img { border:none; } table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; } th { font-weight: normal; text-align: left; } *[class="gmail-fix"] { display: none !important; } </style><style type="text/css" emogrify="no"> @media (max-width: 600px) { .gmx-killpill { content: ' \\03D1';} } </style><style type="text/css" emogrify="no">@media (max-width: 600px) { .gmx-killpill { content: ' \\03D1';} .r0-c { box-sizing: border-box !important; width: 100% !important } .r1-o { border-style: solid !important; width: 100% !important } .r2-i { background-color: transparent !important } .r3-c { box-sizing: border-box !important; text-align: center !important; valign: top !important; width: 320px !important } .r4-o { border-style: solid !important; margin: 0 auto 0 auto !important; width: 320px !important } .r5-i { padding-bottom: 5px !important; padding-top: 5px !important } .r6-c { box-sizing: border-box !important; display: block !important; valign: top !important; width: 100% !important } .r7-i { padding-left: 0px !important; padding-right: 0px !important } .r8-c { box-sizing: border-box !important; text-align: center !important; width: 100% !important } .r9-o { border-style: solid !important; margin: 0 auto 0 auto !important; width: 100% !important } .r10-i { padding-bottom: 13px !important; padding-left: 10px !important; padding-right: 10px !important; padding-top: 15px !important; text-align: center !important } .r11-i { background-color: #9F9F9F !important } .r12-c { box-sizing: border-box !important; text-align: center !important; valign: top !important; width: 100% !important } .r13-i { background-color: #ffffff !important; padding-left: 20px !important; padding-right: 20px !important; padding-top: 35px !important } .r14-c { box-sizing: border-box !important; text-align: center !important; valign: top !important; width: 218px !important } .r15-o { border-style: solid !important; margin: 0 auto 0 auto !important; width: 218px !important } .r16-i { background-color: #ffffff !important; padding-left: 20px !important; padding-right: 20px !important; padding-top: 65px !important } .r17-i { background-color: #ffffff !important; padding-bottom: 90px !important; padding-left: 20px !important; padding-right: 20px !important; padding-top: 55px !important } .r18-c { box-sizing: border-box !important; text-align: left !important; valign: top !important; width: 100% !important } .r19-o { border-style: solid !important; margin: 0 auto 0 0 !important; width: 100% !important } .r20-i { text-align: left !important } .r21-i { padding-top: 40px !important; text-align: left !important } .r22-i { background-color: #ffffff !important; padding-bottom: 20px !important; padding-left: 15px !important; padding-right: 15px !important; padding-top: 20px !important } .r23-o { border-style: solid !important; margin: 0 auto 0 auto !important; margin-bottom: 15px !important; margin-top: 15px !important; width: 100% !important } .r24-i { text-align: center !important } .r25-r { background-color: #ff6363 !important; border-radius: 30px !important; box-sizing: border-box; height: initial !important; padding-bottom: 12px !important; padding-left: 5px !important; padding-right: 5px !important; padding-top: 12px !important; text-align: center !important; width: 100% !important } body { -webkit-text-size-adjust: none } .nl2go-responsive-hide { display: none } .nl2go-body-table { min-width: unset !important } .mobshow { height: auto !important; overflow: visible !important; max-height: unset !important; visibility: visible !important; border: none !important } .resp-table { display: inline-table !important } .magic-resp { display: table-cell !important } } </style><!--[if !mso]><!--><style type="text/css" emogrify="no">@import url("https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap"); @import url("https://fonts.googleapis.com/css2?family=Montserrat"); @import url("https://fonts.googleapis.com/css2?family=Source Sans Pro"); </style><!--<![endif]--><style type="text/css">p, h1, h2, h3, h4, ol, ul { margin: 0; } a, a:link { color: #3F3D56; text-decoration: none } .nl2go-default-textstyle { color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; line-height: 1.3 } .default-button { border-radius: 30px; color: #ffffff; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; font-style: normal; font-weight: bold; line-height: 1.15; text-decoration: none; width: 340px } .sib_class_16_black_reg { color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 16px } .sib_class_16_black_b { color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 16px; font-weight: 700 } .sib_class_20_white_b { color: #ffffff; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; font-weight: 700 } .sib_class_35_black_b { color: #434343; font-family: Noto Sans, Arial, sans-serif; font-size: 35px; font-weight: 700 } .default-heading1 { color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 35px } .default-heading2 { color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 32px } .default-heading3 { color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 24px } .default-heading4 { color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 18px } a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; } .no-show-for-you { border: none; display: none; float: none; font-size: 0; height: 0; line-height: 0; max-height: 0; mso-hide: all; overflow: hidden; table-layout: fixed; visibility: hidden; width: 0; } </style><!--[if mso]><xml> <o:OfficeDocumentSettings> <o:AllowPNG/> <o:PixelsPerInch>96</o:PixelsPerInch> </o:OfficeDocumentSettings> </xml><![endif]--><style type="text/css">a:link{color: #3F3D56; text-decoration: none}</style></head><body bgcolor="#9F9F9F" text="#3F3D56" link="#3F3D56" yahoo="fix" style="background-color: #9F9F9F;"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" class="nl2go-body-table" width="100%" style="background-color: #9F9F9F; width: 100%;"><tr><td align="" class="r0-c"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r1-o" style="table-layout: fixed; width: 100%;"><!-- --><tr><td valign="top" class="r2-i" style="background-color: transparent;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r3-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="600" class="r4-o" style="table-layout: fixed;"><!-- --><tr class="nl2go-responsive-hide"><td height="5" style="font-size: 5px; line-height: 5px;">­</td> </tr><tr><td class="r5-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r6-c"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r1-o" style="table-layout: fixed; width: 100%;"><!-- --><tr><td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r8-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r9-o" style="table-layout: fixed; width: 100%;"><tr class="nl2go-responsive-hide"><td height="15" width="30" style="font-size: 15px; line-height: 15px;">­ </td> <td height="15" style="font-size: 15px; line-height: 15px;">­</td> <td height="15" width="30" style="font-size: 15px; line-height: 15px;">­ </td> </tr><tr><td class="nl2go-responsive-hide" width="30" style="font-size: 0px; line-height: 1px;">­ </td> <td align="center" class="r10-i nl2go-default-textstyle" style="color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; line-height: 1.3; text-align: center;"> <div><p style="margin: 0;"><a href="{{ mirror }}" style="color: #3F3D56; text-decoration: none;"></a></p></div> </td> <td class="nl2go-responsive-hide" width="30" style="font-size: 0px; line-height: 1px;">­ </td> </tr><tr class="nl2go-responsive-hide"><td height="13" width="30" style="font-size: 13px; line-height: 13px;">­ </td> <td height="13" style="font-size: 13px; line-height: 13px;">­</td> <td height="13" width="30" style="font-size: 13px; line-height: 13px;">­ </td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> </tr><tr class="nl2go-responsive-hide"><td height="5" style="font-size: 5px; line-height: 5px;">­</td> </tr></table></td> </tr></table></td> </tr></table></td> </tr><tr><td align="center" class="r3-c"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="600" class="r4-o" style="table-layout: fixed; width: 600px;"><tr><td valign="top" class="r11-i" style="background-color: #9F9F9F;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r12-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r9-o" style="table-layout: fixed; width: 100%;"><!-- --><tr class="nl2go-responsive-hide"><td height="35" width="45" style="font-size: 35px; line-height: 35px; background-color: #ffffff;">­ </td> <td height="35" style="font-size: 35px; line-height: 35px; background-color: #ffffff;">­</td> <td height="35" width="45" style="font-size: 35px; line-height: 35px; background-color: #ffffff;">­ </td> </tr><tr><td class="nl2go-responsive-hide" width="45" style="font-size: 0px; line-height: 1px; background-color: #ffffff;">­ </td> <td class="r13-i" style="background-color: #ffffff;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r6-c"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r1-o" style="table-layout: fixed; width: 100%;"><!-- --><tr><td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r14-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="330" class="r15-o" style="table-layout: fixed; width: 330px;"><tr><td class="" style="font-size: 0px; line-height: 0px;"> <img src="https://img.mailinblue.com/4755828/images/content_library/original/628cef0a0f8141642567729a." width="330" border="0" class="" style="display: block; width: 100%;"></td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> <td class="nl2go-responsive-hide" width="45" style="font-size: 0px; line-height: 1px; background-color: #ffffff;">­ </td> </tr></table></td> </tr><tr><td class="r12-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r9-o" style="table-layout: fixed; width: 100%;"><!-- --><tr class="nl2go-responsive-hide"><td height="65" width="45" style="font-size: 65px; line-height: 65px; background-color: #ffffff;">­ </td> <td height="65" style="font-size: 65px; line-height: 65px; background-color: #ffffff;">­</td> <td height="65" width="45" style="font-size: 65px; line-height: 65px; background-color: #ffffff;">­ </td> </tr><tr><td class="nl2go-responsive-hide" width="45" style="font-size: 0px; line-height: 1px; background-color: #ffffff;">­ </td> <td class="r16-i" style="background-color: #ffffff;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r6-c"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r1-o" style="table-layout: fixed; width: 100%;"><!-- --><tr><td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r12-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="510" class="r9-o" style="table-layout: fixed; width: 510px;"><tr><td class="" style="font-size: 0px; line-height: 0px;"> <img src="http://img-st2.mailinblue.com/2037886/images/rnb/original/5e8b3d5205e24b03f73fe894.png" width="510" border="0" class="" style="display: block; width: 100%;"></td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> <td class="nl2go-responsive-hide" width="45" style="font-size: 0px; line-height: 1px; background-color: #ffffff;">­ </td> </tr></table></td> </tr><tr><td class="r12-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r9-o" style="table-layout: fixed; width: 100%;"><!-- --><tr class="nl2go-responsive-hide"><td height="55" width="45" style="font-size: 55px; line-height: 55px; background-color: #ffffff;">­ </td> <td height="55" style="font-size: 55px; line-height: 55px; background-color: #ffffff;">­</td> <td height="55" width="45" style="font-size: 55px; line-height: 55px; background-color: #ffffff;">­ </td> </tr><tr><td class="nl2go-responsive-hide" width="45" style="font-size: 0px; line-height: 1px; background-color: #ffffff;">­ </td> <td class="r17-i" style="background-color: #ffffff;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r6-c"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r1-o" style="table-layout: fixed; width: 100%;"><!-- --><tr><td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r18-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r19-o" style="table-layout: fixed; width: 100%;"><tr><td align="left" valign="top" class="r20-i nl2go-default-textstyle" style="color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; line-height: 1.3; text-align: left;"> <div><h1 class="default-heading1" style="margin: 0; color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 35px;">Welcome to Perso Space</h1></div> </td> </tr></table></td> </tr><tr><td class="r18-c" align="left"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r19-o" style="table-layout: fixed; width: 100%;"><tr class="nl2go-responsive-hide"><td height="40" style="font-size: 40px; line-height: 40px;">­</td> </tr><tr><td align="left" valign="top" class="r21-i nl2go-default-textstyle" style="color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; line-height: 1.3; text-align: left;"> <div><p style="margin: 0;">Hello</p><p style="margin: 0;">We are happy to see you in our family </p><p style="margin: 0;">bellow you will find your email and your Passwprd</p><p style="margin: 0;">Email : ${email.toLowerCase()}</p><p style="margin: 0;">Password : ${password}</p><p style="margin: 0;"> </p><p style="margin: 0;"> </p><p style="margin: 0;">to login Click the button </p></div> </td> </tr></table></td> </tr></table></td> </tr></table></th> </tr></table></td> <td class="nl2go-responsive-hide" width="45" style="font-size: 0px; line-height: 1px; background-color: #ffffff;">­ </td> </tr><tr class="nl2go-responsive-hide"><td height="90" width="45" style="font-size: 90px; line-height: 90px; background-color: #ffffff;">­ </td> <td height="90" style="font-size: 90px; line-height: 90px; background-color: #ffffff;">­</td> <td height="90" width="45" style="font-size: 90px; line-height: 90px; background-color: #ffffff;">­ </td> </tr></table></td> </tr><tr><td class="r12-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r9-o" style="table-layout: fixed; width: 100%;"><!-- --><tr class="nl2go-responsive-hide"><td height="20" style="font-size: 20px; line-height: 20px; background-color: #ffffff;">­</td> </tr><tr><td class="r22-i" style="background-color: #ffffff;"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><th width="100%" valign="top" class="r6-c"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" class="r1-o" style="table-layout: fixed; width: 100%;"><!-- --><tr><td class="nl2go-responsive-hide" width="15" style="font-size: 0px; line-height: 1px;">­ </td> <td valign="top" class="r7-i"> <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation"><tr><td class="r12-c" align="center"> <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="340" class="r23-o" style="table-layout: fixed; width: 340px;"><tr class="nl2go-responsive-hide"><td height="15" style="font-size: 15px; line-height: 15px;">­</td> </tr><tr><td height="23" align="center" valign="top" class="r24-i nl2go-default-textstyle" style="color: #3F3D56; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; line-height: 1.3;">  <!--[if mso]> <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="" style="v-text-anchor:middle; height: 46px; width: 339px;" arcsize="50%" fillcolor="#ff6363" strokecolor="#ff6363" strokeweight="1px" data-btn="1"> <w:anchorlock/> <div style="display:none;"> <center class="default-button"><p>LOGIN</p></center> </div> </v:roundrect> <![endif]-->  <!--[if !mso]><!-- --> <a class="r25-r default-button" href="${process.env.url}" target="_blank" data-btn="1" style="font-style: normal; font-weight: bold; line-height: 1.15; text-decoration: none; border-style: solid; display: inline-block; -webkit-text-size-adjust: none; mso-hide: all; background-color: #ff6363; border-bottom-width: 0px; border-color: #ff6363; border-left-width: 0px; border-radius: 30px; border-right-width: 0px; border-top-width: 0px; color: #ffffff; font-family: Noto Sans, Arial, sans-serif; font-size: 20px; height: 23px; padding-bottom: 12px; padding-left: 5px; padding-right: 5px; padding-top: 12px; width: 330px;"><p style="margin: 0;">LOGIN</p></a> <!--<![endif]--> </td> </tr><tr class="nl2go-responsive-hide"><td height="15" style="font-size: 15px; line-height: 15px;">­</td> </tr></table></td> </tr></table></td> <td class="nl2go-responsive-hide" width="15" style="font-size: 0px; line-height: 1px;">­ </td> </tr></table></th> </tr></table></td> </tr><tr class="nl2go-responsive-hide"><td height="20" style="font-size: 20px; line-height: 20px; background-color: #ffffff;">­</td> </tr></table></td> </tr></table></td> </tr></table></td> </tr></table></body></html>





`

                        })


                        User.create(query).then(async (u) => {

                            u.password = undefined;


                            let sender = await User.findOne({_id: req.body.user_id})

                            User.find({
                                role: "administrateur",
                                _id: {$nin: [`${req.body.user_id}`,u._id]}
                            }).then(async (User) => {
                                    let NotificationListe = []
                                    for (let item of User) {
                                        let noti = await notification.create({
                                            receiver: item._id,
                                            sender: req.body.user_id,
                                            idNotified: u._id,
                                            type: "AddUser",
                                            read: false,
                                            text: ` add ed  a new user named `
                                        })


                                        NotificationListe.push({user:sender,notification:noti,NameShared:u.username,UserId:item._id} )
                                    }
                                    res.json({
                                        success: true,
                                        user: u,
                                        msg: 'The user was successfully registered',
                                        NotificationListe
                                    });

                                }
                            )


                        })
                    }catch (e){


                        res.status(422).json({

                            success: false,
                            msg: "internal Problem please try later",
                        });


                    }

                    ;
                });
            });
        }
    });
}

