// SourceView.js
// -------
define(["jquery", "backbone", "edittool/js/jquery.shapeshift.adapted"],

    function($, Backbone, shapeshift){

        var SourceView = Backbone.View.extend({

            // The DOM Element associated with this view
            el: ".source",

            // View constructor
            initialize: function() {
                
                //if collection changes, view will be rendered
                _.bindAll(this, "render");
                this.collection.bind("reset", this.render);

            },            

            // View Event Handlers
            events: {

            },
            
            // Renders the view's template to the UI
            render: function() {                
                var parent = this.$el;
                this.collection.each(function(segment){
                    var div = $(document.createElement('div'));
                    $(div).attr('data-ss-colspan', "100");
                    segment.loadImage("front", function(image_data){
                        $(div).html(image_data); 
                        $(div).attr('width', 100);
                        $(div).attr('height', 100);
                        $(div).find('svg')[0].setAttribute("viewBox", "0 0 2000 1050");
                        $(div).find('svg')[0].setAttribute("width", "100%");
                        $(div).find('svg')[0].setAttribute("height", "100%");
                        //$(div).find('svg')[0].setAttribute("preserveAspectRatio","none");
                        $(div).find('svg')[0].setAttribute("preserveAspectRatio","xMidYMid slice");
                    });
                    parent.append(div);
                    //"connect" the div with its segment
                    $(div).attr('id', segment.id);
                });             
                
                this.loadBorder($('#left_border'), 'left');
                this.loadBorder($('#right_border'), 'right');
                
                $(".trash").shapeshift({
                  autoHeight: false,
                  colWidth: 1,
                  enableTrash: true
                });
                //register the container with it's childs to shapeshift
                parent.shapeshift({
                    dragClone: true,
                    colWidth: 1,
                    gutterX: 0,
                    enableCrossDrop: false
                });
                return this;

            },
                        
            loadBorder: function(container, side){
                var imageID, aspectRatio;
                switch (side){
                    case "left": 
                        imageID = 1;
                        aspectRatio = "xMidYMax slice";
                        break;
                    case "right": 
                        imageID = 2;
                        aspectRatio = "xMidYMax slice";
                        break;
                    default: 
                        imageID = 1;
                        break;
                }
                    
                var xmlhttp = new XMLHttpRequest();
                xmlhttp.onreadystatechange = function(){
                    if (xmlhttp.readyState==4 && xmlhttp.status==200){
                        var image_data = JSON.parse(xmlhttp.responseText).img_svg;
                        container.html(image_data); 
                        container.attr('width', 100);
                        container.attr('height', 100);
                        container.find('svg')[0].setAttribute("viewBox", "0 0 750 1050");
                        container.find('svg')[0].setAttribute("width", "100%");
                        container.find('svg')[0].setAttribute("height", "100%");
                        container.find('svg')[0].setAttribute("preserveAspectRatio", aspectRatio);
                    }
                };                
                xmlhttp.open("GET","db/images/" + imageID, true);
                xmlhttp.send();
            }
        });

        // Returns the View class
        return SourceView;

    }

);