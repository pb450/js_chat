var addPersonModal;// = $("#add_contact_modal_bg_div");

var currentConversation;
var newestMessageTime = -1000000;

var conversations = [];

function AddNewMessage(type, content, unix) {
    var zone = $("#chat_boubble_zone");

    var chatEntry = document.createElement("div");
    $(chatEntry).addClass(["chat_entry", type == 0 ? "my" : "other"]);

    var chat_entry_display = document.createElement("chat_entry_display");
    $(chat_entry_display).addClass("chat_entry_display")

    var message = document.createElement("label");
    $(message).text(content);

    var time = document.createElement("label")
    $(time).text(unix).addClass("message-date");

    $(chat_entry_display).append([message, time]);
    $(chatEntry).append(chat_entry_display)

    zone.append(chatEntry);
}

window.onload = function() {

    console.log("Welcome to chat :)");

    $('#person_talk_data').hide();

    var addPersonModal = $("#add_contact_modal_bg_div");
    addPersonModal.hide();

    $('#add_contact_box_cancel').on('click', () => {
        addPersonModal.hide();
    });

    $("#add_contact_person").on('click', function() {
        addPersonModal.show();
        $("#add_contact_code").text("");
    }); 

    $("#add_user_form").submit(function(e) {
        e.preventDefault();
        $.ajax({
            url:'/addContact',
            type: 'post',
            data: $("#add_user_form").serialize(),
            success: function() {
                //console.log("ok");
                //window.location.pathname = "/";
            }
        })

        addPersonModal.hide();
    })


    LoadDataOnStart();

    $('#send_button').on('click', () => {
        SendMessage();
    });

    $('#refresh_contact_person').on('click', function() {
        RefreshContactList();
    });

    $("#logout_button").on('click', () => {
        //Logout();
    });

    $("#attach_button").on('click', () => {
        if (currentConversation != undefined) {
            $("#file_area").trigger('click');
        }
        
    });

    $("#file_area").on('change', (e) => {
        if (currentConversation != undefined) {
            LoadAndSendFile(e);
        }
    });

    UpdateMessages();
}

function LoadAndSendFile(e) {
    //$("#file_area_form").trigger('submit');

    var img = document.querySelector("#file_area").files[0];

    var fd = new FormData();
    fd.append('conv', currentConversation);
    fd.append('uploaded_file', img);
    

    $.ajax({
        url: '/upload',
        data: fd,
        processData: false,
        contentType: false,
        type: 'POST',
        //headers: {
        //    "Content-Type": "multipart/form-data"
        //},
        success: function(data) {
            console.log(data);
        }
    });

}

function Logout() {
    fetch('/logout', {
        method: 'post'
    });
}

function UpdateMessages() {
    setInterval(() => {
        UpdateConv();
    }, 1000);
}

function UpdateConv() {
    if (currentConversation != undefined) {
        LoadConv(currentConversation, newestMessageTime);
    }
}

function RefreshContactList() {
    $("#contacts_field").find('.hcNSz3q0').remove();
    $("#contacts_field_element_EXAMPLE").show();
    LoadDataOnStart();
}

async function LoadDataOnStart() {
    var rsp = await fetch('/getData');
    var nm = await rsp.json();

    conversations = [];
    if (!nm.error) {
        $("#curr_user_label").text(nm.account.username);
        $("#curr_user_code").text(nm.account.id_3);
        $("#curr_user_img").attr("username", nm.account.img)

        //console.log(nm.convs);

        nm.convs.forEach(element => {
            var copy = $("#contacts_field_element_EXAMPLE").clone();
            copy.attr('conv', element.conv);
            copy.addClass('hcNSz3q0');
            copy.find(".contacts_field_element_label").text(element.name);
            copy.find(".user-image").attr('username', element.img)

            $("#contacts_field").append(copy);

            conversations[element.conv] = {"name" : element.name, "img" : element.img};
            copy.on('click', function() {
                SelectConv(this);
            });
        });


        $("#contacts_field_element_EXAMPLE").hide();
    }
}

function SelectConv(e) {
    var conv = $(e).attr('conv');
    currentConversation = conv;
    newestMessageTime = -100000;
    LoadConv(currentConversation);
}

async function LoadConv(x, after = -1) {
    //console.log(x);

    $("#person_talk_data").show();
    if (after == -1)
        $("#chat_boubble_zone").empty();

        var dx = conversations[x];
        $("#curr_conv_person_img").attr('username', dx.img);
        $('#curr_conv_person_name').text(dx.name);

    var _url = '/getConversation' + (after == -1 ? '' : '?after=' + after);
    $.ajax({
        url:_url,
        type: 'post',
        data: {"id" : x},
        success: function(ctx) {
            if (!ctx.error)
                if (after == -1)
                    ContinueLoading(ctx);
                else
                    ContinueLoading(ctx, 'update');
            else
                console.log(ctx.error);
        }
    })
};

function ContinueLoading(a, src='main_load') {

    //e.log(a);

    a.messages.forEach(element => {
        var x1 = document.createElement("div");
        var ced = document.createElement("div");

        var msg_text;// = document.createElement("label");
        var date_msg_text = document.createElement("label");

        $(x1).attr("class", "chat_entry " + (!element.mode ? "my" : "other"));
        $(ced).attr("class", "chat_entry_display");

        if (element.type == "text") {
            msg_text = document.createElement("label");
            $(msg_text).text(element.ctx);
        } else {
            msg_text = document.createElement("div");
            msg_text_filename = document.createElement("label");

            var msg_text_filename_ahref = document.createElement("a");
            $(msg_text_filename_ahref).attr('href', '/download?id=' + element.file.id);//text(element.file.filename);


            msg_text_filename_ahref.append(msg_text_filename);

            msg_text_img = document.createElement("img");

            $(msg_text_filename).text(element.file.filename);
            $(msg_text_img).attr("src", "img/file.svg");

            msg_text.append(msg_text_img);
            msg_text.append(msg_text_filename_ahref);
            
            //$(msg_text_filename).

            $(msg_text).addClass('file_msg_div');
            //$(msg_text).text(element.file.filename);
        }
        

        var formattedDate = dayjs.unix(element.date).format("HH:mm DD.MM.YYYY");
        $(date_msg_text).text(formattedDate).attr('class', 'message-date');

        if (newestMessageTime < Number(element.date)) {
            newestMessageTime = Number(element.date);
        }

        x1.append(ced);
        ced.append(msg_text);
        ced.append(date_msg_text);

        src == 'update' ? $("#chat_boubble_zone").append(x1) : $("#chat_boubble_zone").prepend(x1);
    });

    if (a.messages.length > 0) {
        var idOfDivWhatever = '#chat_boubble_zone'
        $(idOfDivWhatever).scrollTop($(idOfDivWhatever)[0].scrollHeight);
    }
}

function DownloadFile(e) {
   
}

function SendMessage() {
    var txt = $('#text_area').val();

    if (txt.length > 0 && currentConversation != undefined) {
        $('#text_area').val('');
        
        $.ajax({
            url:'/sendMessage',
            type: 'post',
            data: {"conv": currentConversation, "content": txt, "type": "text"},
            success: function() {
                //console.log("ok");
            }
        })
    }
}
