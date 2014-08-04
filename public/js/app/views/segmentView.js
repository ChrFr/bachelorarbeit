// SourceView.js
// -------
define(["jquery", "backbone", "text!templates/segment.html"],

    function($, Backbone, template){

        var SegmentView = Backbone.View.extend({

            // View constructor
            initialize: function(options) {
                //options
                this.cloneable = options.cloneable || false;
                this.segment = options.segment;
                this.leftOffset = options.leftOffset;
                this.pixelRatio = options.pixelRatio || 1;
                this.width = options.width || 100;
                this.height = options.height || 100;
                this.offset = options.offset;
                this.insertSorted = options.insertSorted || false;
                this.fixed = options.fixed || false;
                //processed attributes
                this.left = 0;
                this.div = null;
                this.next = null;
                this.prev = null;
                //this.render();
            },            

            // View Event Handlers
            events: {

            },
                        
            // Renders the view's template to the UI
            render: function() {  
                if (!(this.segment)) return this;
                this.template = _.template(template, {}); 
                var div = document.createElement("div");   
                this.div = div;
                $(div).html(this.template);                    
                this.$el.append(div);
                $(div).css('width', this.width);
                $(div).css('height', this.height);
                if (this.leftOffset){
                    $(div).css('left', this.leftOffset);
                    this.left = this.leftOffset - this.$el.offset().left;
                    this.segment.startPos = this.left / this.pixelRatio;
                };
                var image = $(div).find('.image');
                this.segment.loadImage("front", function(image_data){
                    image.html(image_data); 
                    image.find('svg')[0].setAttribute("viewBox", "0 0 2000 1050");
                    image.find('svg')[0].setAttribute("width", "100%");
                    image.find('svg')[0].setAttribute("height", "100%");
                    image.find('svg')[0].setAttribute("preserveAspectRatio","xMidYMid slice");   
                });

                //give the div information about the segment it is viewing
                $(div).data('segmentID', this.segment.attributes.id); 
                $(div).data('segmentViewID', this.cid); 
                if (!this.fixed) {
                    $(div).addClass('segment');
                    this.makeDraggable();
                    if (!this.cloneable)
                       this.makeResizable();
                }
                return this;

            },
                        
            makeDraggable: function(){
                var _this = this;
                var outside = true;
                if (this.cloneable)
                    $(this.div).draggable({
                        helper: 'clone',
                        cursor: "move", 
                        cursorAt: { top: 0, left: 0 },
                        start: function (e, dragged) {    
                            var clone = $(dragged.helper);
                            clone.addClass('dragged');
                            //class is for css style only
                            //$(div).attr('id', this.segment.id); 
                            //addClass('segment')
                        }, 
                    });
                else 
                     $(this.div).draggable({
                        cursor: "move", 
                        cursorAt: { 
                            top: parseInt($(_this.div).css('height'))/2, 
                            left: -20
                        },
                        start: function (e, dragged){
                            //keep track if div is pulled in or out to delete
                            _this.$el.on("dropout", function(e, ui) {
                                outside = true;
                            });
                            _this.$el.on("drop", function(e, ui) {
                                outside = false;
                            });
                            var dragged = $(dragged.helper);
                            dragged.addClass('dragged');
                        },
                        
                        stop: function (e, dragged){
                            var dragged = $(dragged.helper);
                            if (outside){
                                _this.delete();
                            }
                            else {
                                dragged.removeClass('dragged');
                                _this.left = dragged.offset().left - _this.$el.offset().left;
                                _this.segment.startPos = _this.left / _this.pixelRatio;
                                _this.trigger("moved");
                            };
                        }
                    });
            },
            
            delete: function(){                
                this.div.remove();
                this.trigger('delete');
            },
            
            makeResizable: function(){
                var _this = this;
                var div = this.div;                
                var maxWidth = 0;
                $(div).resizable({
                    autoHide: true,
                    handles: {
                      'w': '#lefthandle',
                      'e': '#righthandle'
                    },
                    start: function(e, ui){
                        //prevent showing the handles of neighbours while resizing
                        $('.ui-resizable-handle').css('visibility', 'hidden');
                        $(div).find('.ui-resizable-handle').css('visibility', 'visible');
                        //max width for resizing to the left
                        if ($(e.toElement).attr('id') === 'lefthandle'){
                            //is there a segment to the left?
                            if (_this.prev) {
                                var space = _this.left - (_this.prev.left + _this.prev.width);                  
                            }   
                            //no segment infront? take the border of the editor
                            else {
                                var space = _this.left; 
                            }
                            maxWidth = space + _this.width;                 
                        }
                        //max width for resizing to the right
                        else if ($(e.toElement).attr('id') === 'righthandle'){
                            //is there a segment to the right?
                            if (_this.next) {
                                var space = _this.next.left - (_this.left + _this.width);
                            }          
                            //no segment behind? take the border of the editor
                            else {
                                var space = parseInt(_this.$el.css('width'))-
                                        (_this.left + _this.width); 
                            }  
                            maxWidth = space + _this.width;  
                        }
                        $(div).resizable( "option", "maxWidth", maxWidth );
                    },
                    stop: function(e, ui){  
                        _this.width = parseInt($(div).css('width'));
                        _this.left = $(div).offset().left - _this.$el.offset().left;                        
                        _this.segment.size = _this.width / _this.pixelRatio
                        console.log(_this.segment.size);
                        //make all other handles visible again (while hovering)
                        $('.ui-resizable-handle').css('visibility', 'visible');
                    }
                }); 
            }                        
               
        });

        // Returns the View class
        return SegmentView;

    }

);