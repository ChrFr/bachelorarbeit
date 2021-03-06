// EditorView.js
// -------
define(["jquery", "backbone", "views/SegmentView", "touchpunch"],

    /**
    * The editor view on a street profile (SegmentCollection). The Segments are 
    * movable and droppable inside the editor. Shows a measurement of the real
    * sizes of the segments as an overlay.
    *
    * @param options.el           the tag of the DOM Element, the editor will be rendered in
    * @param options.resources    SegmentCollection containing the resources of the project
    * @param options.collection   SegmentCollection containing the street profile currently worked on
    * @param options.images       an ImageCollection with the images of the segments
    * @param options.adminMode    boolean, is a user with extended rights logged in? (if not: fixed elements can't be moved, if: render additional grid)
    * @param options.wrapper      the wrapper around the editor dom element (options.el), needed for zoom
    * @param options.thumbSize    the size of the thumbnails (in pixel) for dragged segments, default: 100
    * @param options.streetSize   the size of the street (in cm), default: will be calculated inside the collection (or 10m, if street size can't be calc.)
    * @return                     the EditorView class
    * @see                        an editor showing the street profile of the given SegmentCollection
    */ 
    function($, Backbone, SegmentView){

        var EditorView = Backbone.View.extend({

            // The DOM Element associated with this view
            el: ".sink",

            // View constructor
            initialize: function(options) {  
                //check if svg is unsupported or png is preferred by project-> use png instead of svg
                var svgSupported = document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#Image", "1.1");
                if(this.collection.project.preferPNG || !svgSupported)
                    this.pngPreferred = true;
                
                this.images = options.images;
                this.resources = options.resources; 
                this.adminMode = options.adminMode || false;
                this.fixElements = !this.adminMode;                  
                this.thumbSize = options.thumbSize || 100;
                this.streetSize = options.startSize || this.collection.getStreetSize() || 1000;
                this.zoom = 100;                
                this.width = this.$el.width;
                this.wrapper = $(options.wrapper);
                var _this = this;
                this.resources.changeProject(this.collection.project);
                _.bindAll(this, 'render', 'renderEdition');                 
                this.collection.bind("reset", function(){                    
                    var streetSize = this.getStreetSize();                    
                    var startSize = options.startSize || 0;
                    _this.streetSize = (startSize < streetSize) ? streetSize: startSize;
                    _this.render();
                });  
                
                //only 5cm steps (more precise is not executable while
                //actually building streets)
                this.steps = 5;
                
                this.render();         
            },       
            
            // View Event Handlers
            events: {
				//no click for controls events in here, renderControls takes this part (problems with rerendering)
            },        
                        
            // Renders the view's template to the UI
            render: function() {   
                var canvas = $('canvas')[0];                
                this.measure = new this.MeasureDisplay(canvas, this.$el, 
                                            this.streetSize, this.adminMode);
                this.segmentViewList = new this.SegmentViewList(this.$el, this.collection, this.measure);
                this.placeholder = new this.Placeholder(this.segmentViewList, this.$el);
                this.segmentViewList.changeScale(this.pixelRatio());  
                this.renderControls()
                this.makeDroppable();
                if (this.collection.length > 0)
                    this.renderEdition();   
                return this;
            },
            
            //make the editor container droppable for segments
            makeDroppable: function(){
                var _this = this;
                this.wrapper.droppable({
                    tolerance: "fit",
                    cursor: 'auto',
                    over: function(e, dragged) {
                        var clone = $(dragged.helper); 
                        clone.removeClass('out');
                        var width = clone.data('size') * _this.pixelRatio();
                        var draggedDiv = dragged.draggable;
                        _this.placeholder.setActive(true, clone, width);
                        draggedDiv.on( "drag", function( event, ui ) {
                            _this.placeholder.updatePos(event.clientX);
                        } );
                        return;
                    },
                    drop: function(e, dropped) {
                        //if the origin of the dropped segment is not this container
                        //clone the segment and make a new view
                        var draggedDiv = dropped.draggable;
                        var placeholder = _this.placeholder;
                        if (_this.el !== draggedDiv.parent()[0]){
                            if (placeholder.droppable){
                                var segment = _this.resources.getSegmentByID(draggedDiv.data('segmentID')); 
                                var clonedSegment = segment.clone();
                                var left = placeholder.left;
                                clonedSegment.size = dropped.helper.data('size');                                
                                var segmentView = new SegmentView({el: _this.el,
                                                                   segment: clonedSegment,
                                                                   steps: _this.steps,
                                                                   adminMode: _this.adminMode,
                                                                   left: left,
                                                                   thumbSize: _this.thumbSize,
                                                                   height: parseInt(placeholder.div.css('height')),
                                                                   pixelRatio: _this.pixelRatio(),
                                                                   images: _this.images,
                                                                   pngPreferred: this.pngPreferred});
                                segmentView.render();
                                segmentView.setLeft(left);
                                _this.collection.addSegment(clonedSegment);
                                _this.segmentViewList.insert(segmentView);
                                _this.collection.checkRules();
                            };                            
                            dropped.helper.remove();
                        }
                        //else move the existing element to the position of the
                        //placeholder
                        else if (placeholder.droppable){            
                            //place the div on the position of the
                            //placeholder and prevent moving back
                            var left = placeholder.left;// + offsetScroll;
                            draggedDiv.css('top', _this.$el.css('top'));
                            draggedDiv.css('left', left);
                            var segmentView = _this.segmentViewList.getView(draggedDiv.data('segmentViewID'));
                            segmentView.setLeft(left);                                
                            segmentView.trigger("moved");
                            draggedDiv.draggable( "option", "revert", false );
                        }
                        else
                            //move the div back to its former position
                            draggedDiv.draggable( "option", "revert", true );
                        placeholder.setActive(false);
                    },
                    out: function(e, dragged){
                        var clone = $(dragged.helper);                            
                        clone.addClass('out');
                        _this.placeholder.setActive(false);
                    }
                });
            },
            
            /**
            * A double concatenated list of the SegmentViews, rendered inside
            * the container. Listens to the events fired when manipulating them, 
            * and passes the changes to the street profile (SegmentCollection)
            *
            * @param parent         the container, the SegmentViews are rendered in (most likely the editor container)
            * @param streetProfile  SegmentCollection, representing the street profile, that is edited
            * @param measureDisplay MeasureDisplay, the object rendering the measurements
            */ 
            SegmentViewList: function(parent, streetProfile, measureDisplay){
                this.parent = parent;
                this.streetProfile = streetProfile;
                this.first = null;
                this.length = 0;
                this.measureDisplay = measureDisplay;                
                this.pixelRatio = 1;
                
                //
                this.changeScale = function(pixelRatio){
                    var changeRatio = pixelRatio / this.pixelRatio;
                    this.pixelRatio = pixelRatio;
                    var segmentView = this.first;
                    while (segmentView) {
                        var left = segmentView.left * changeRatio;
                        var width = segmentView.width * changeRatio;
                        segmentView.pixelRatio = pixelRatio;
                        segmentView.left = left;
                        segmentView.width = width;
                        segmentView.render();
                        segmentView = segmentView.next;
                    };      
                    this.streetProfile.checkRules(); 
                    this.measureDisplay.resize();
                    this.measureDisplay.draw(this);    
                };
                                
                //return the SegmentView at given position                
                this.at = function(pos){
                    var found = null;
                    var segmentView = this.first;
                    var i = 0;
                    while (segmentView) {
                        if (i === pos) {
                            found = segmentView;
                            break;
                        };
                        segmentView = segmentView.next;
                        i++;
                    };
                    return found;
                };          

                //check if the given div fits into the rendered street profile
                //isConnector determines, if the segment is a connecting element
                //return an object with the attributes:
                //       fits: does the div fit?
                //       left: gap to the next div to the left (in pixel)
                //       right: gap to the next div to the right (in pixel)
                this.doesFit = function(div, isConnector){
                    var left = $(div).offset().left - parent.offset().left;
                    var width = parseInt($(div).css('width'));
                    var right = left + width;
                    var editorWidth = parseInt(parent.css('width'));
                    var gap = {fits: false,
                               left: 0,
                               right: 0};
                    var divID = div.data('segmentViewID');
                    if (!this.first){
                        if (width <= editorWidth) {
                            gap.fits = true;
                            gap.left = left;
                            gap.right = editorWidth - right;
                        }
                        return gap;
                    };
                    //temporary first element is left border
                    var tmp = {left: 0, width: 0, cid: null, next: this.first};
                    var segmentView = tmp;
                    while(segmentView){      
                        //ignore segmentView currently dragged                        
                        if ((divID && segmentView.cid === divID) || segmentView.isConnector){
                            segmentView = segmentView.next;                
                            continue;
                        }     
                        var segLeft = segmentView.left;
                        var segRight = segLeft + segmentView.width; 
                        var next = segmentView.next;
                        if (next){     
                            //ignore connectors and segmentView currently dragged
                            if (next.isConnector){
                                next = next.next;
                            }
                            if (next.cid === divID){
                                next = next.next;
                            }
                            if (next && next.isConnector){
                                next = next.next;
                            }
                        };            
                        //take editor border, if there is no next segment
                        var nextLeft = (next) ? next.left: editorWidth;

                        //2 segments found, where div is in between
                        if (!isConnector && left >= segRight && left < nextLeft){
                            //enough room for the div?      
                            if (right <= nextLeft){  
                                gap.fits = true;
                            }
                            gap.left = left - segRight;
                            gap.right = nextLeft - right;
                            //break loop, because list is sorted 
                            break;
                        }
                        else if (isConnector && right >= segRight && left <=nextLeft){
                            if (Math.abs(nextLeft - segRight) <= 1){  
                                gap.fits = true;
                                gap.left = (left - segRight) / 2;
                                gap.right = (nextLeft - right) / 2;
                            }
                        }
                        
                        segmentView = segmentView.next;
                    };                    
                    tmp.next = null;                    
                    return gap;
                };

                //insert the given SegmentView into the list
                this.insert = function(segmentView){
                    if (!this.first){
                        this.first = segmentView;
                        segmentView.prev = null;
                        segmentView.next = null;
                    }
                    else {
                        var next = this.first;
                        var prev = null;
                        while(next){ 
                            if (segmentView.left <= next.left)
                                break;        
                            prev = next;
                            next = next.next;
                        };
                        segmentView.prev = (prev) ? prev : null;
                        if (!prev){
                            this.first = segmentView;
                        }
                        segmentView.next = (next) ? next : null;
                        if (segmentView.prev)
                            segmentView.prev.next = segmentView;
                        if (segmentView.next)
                            segmentView.next.prev = segmentView;;               
                    };                    
                    var _this = this;
                    segmentView.on("moved", function(){                            
                        _this.relocate(this);
                        _this.streetProfile.checkRules();
                    });
                    segmentView.on("resized", function(){
                        //_this.measureDisplay.drawInfoLine(_this);
                    });
                    segmentView.on("delete", function(){  
                        _this.remove(this, true);
                        _this.streetProfile.checkRules();
                    });
                    segmentView.on("update", function(){  
                        _this.measureDisplay.draw(_this);
                        _this.streetProfile.checkRules();
                    });           
                    segmentView.pixelRatio = this.pixelRatio;  
                    this.length++;
                    this.measureDisplay.draw(this);
                };

                //remove the given SegmentView from the list, if doDelete: the corresponding 
                //segment is removedfrom the street profile
                this.remove = function(segmentView, doDelete){
                    segmentView.off("moved");
                    segmentView.off("delete");
                    segmentView.off("resized");
                    //bend pointers                    
                    var prev = segmentView.prev;
                    var next = segmentView.next;
                    if (prev)
                        prev.next = (next) ? next: null;
                    if (next)
                        next.prev = (prev) ? prev: null;
                    if (!prev)
                        this.first = next;     
                    segmentView.prev = null;
                    segmentView.next = null;
                    this.length--;
                    this.measureDisplay.draw(this);
                    //ToDo: remove view, segmentView.remove() removes the whole 
                    //editor (most likely because the parent el is the editor)
                    if (doDelete)
                        this.streetProfile.remove(segmentView.segment);
                };

                //remove all SegmentViews inside this list
                this.clear = function(){
                    var segmentView = this.first;
                    while(segmentView){  
                        segmentView.unbind();
                        segmentView.delete();
                        segmentView = segmentView.next;
                    };
                    this.first = null;
                    this.measureDisplay.draw(this);
                };
                
                //replace a single view to maintain sort order
                this.relocate = function(segmentView){
                    this.remove(segmentView);
                    this.insert(segmentView);  
                    this.measureDisplay.draw(this);                      
                };
                
                //find and return a SegmentView by its cid
                this.getView = function (cid){
                    var segmentView = this.first;
                    while(segmentView){                         
                        //ignore segmentView currently dragged
                        if (cid === segmentView.cid){
                            return segmentView;                        
                        }
                        segmentView = segmentView.next;
                    };
                    return null;
                };
            },
                        
            /**
            * draws measurements onto the editor, including size of segments and 
            * gaps as well as the metric scale and width of the street
            *
            * @param canvas      the canvas element, the measurements are drawn onto
            * @param parent      the container, the canvas overlays (most likely the editor container)
            * @param streetSize  the size of the street (in cm)
            * @param showRaster  boolean, if true: draws a grid overlaying the street
            * @see               measurements of the street profile
            */ 
            MeasureDisplay: function(canvas, parent, streetSize, showRaster){
                this.canvas = canvas;
                this.streetSize = streetSize;
                this.parent = parent;
                this.marginTop = 0;
                this.marginBottom = 0;
                this.gapTolerance = 1;
                this.showRaster = showRaster || false;                
                
                //adapt canvas to current parent                 
                this.resize = function(){                    
                    var width = parseInt(this.parent.css('width'));
                    var height = parseInt(this.parent.css('height'))
                                 //+ this.marginTop + 
                                 //this.marginBottom;
                    $(this.canvas).css('top', -this.marginTop );
                    $(this.canvas).css('width', width);
                    $(this.canvas).css('height', height); 
                    this.canvas.width = width;
                    this.canvas.height = height;
                };
                
                //draw the measurements onto canvas
                this.draw = function(segmentViewList){                      
                    this.drawScalingLine(segmentViewList);
                    this.drawInfoLine(segmentViewList);
                };
                
                //setLineDash deactivated, because of incompatibilities with Firefox!!
                //draws the sizes of the gaps and segments on the bottom of the canvas
                this.drawScalingLine = function(segmentViewList){
                    var ratio = segmentViewList.pixelRatio;
                    var ctx = this.canvas.getContext("2d");
                    //var w = (this.showRaster) ? this.canvas.height - this.marginBottom : this.marginTop;
                    //clear upper area
                    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);                    
                    var firstSegment = segmentViewList.at(0);
                    var lastSegment = segmentViewList.at(segmentViewList.length - 1);
                    var streetStart = (firstSegment && firstSegment.segment.fixed) ? 
                        firstSegment.segment.startPos + firstSegment.segment.size: 0; 
                    var streetEnd = (lastSegment && lastSegment.segment.fixed) ?
                        lastSegment.segment.startPos: this.streetSize;  
                    var size = streetEnd - streetStart;           
                    var middle = size / 2 + streetStart;
                    var y = 13;
                    ctx.strokeStyle = 'grey';
                    //ctx.setLineDash([0]);
                    //horizontal line 
                    ctx.beginPath();
                    ctx.moveTo(streetStart * ratio, y);
                    ctx.lineTo(streetEnd * ratio, y); 
                    ctx.lineWidth = 1;
                    ctx.stroke();  
                    //vertical lines and raster                            
                    ctx.font = "8px Arial";                            
                    ctx.fillStyle = 'grey';
                    ctx.textAlign = 'left';
                    var step = 10;
                    var i = 0;
                    //draw a small line every meter
                    for(var x = (streetStart * ratio); x <= (streetEnd * ratio +1); x += (step * ratio)){ 
                        var length = 4;
                        var bigStep = ((i % 10) === 0) ? true: false;
                        ctx.beginPath();     
                        ctx.strokeStyle = 'black';
                        //ctx.setLineDash([0]);
                        if (bigStep){
                            length = 8;    
                            ctx.fillText(i / 10, x, y + 13);
                        }
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, y + length); 
                        ctx.stroke();
                        if (this.showRaster) {
                            ctx.beginPath();  
                            if (bigStep){
                                //ctx.setLineDash([2,2]);
                            }                            
                            else {
                                //ctx.setLineDash([1,4]);
                                ctx.strokeStyle = 'grey';
                            }
                            ctx.moveTo(x, y);
                            ctx.lineTo(x, this.canvas.height - this.marginBottom); 
                            ctx.stroke();
                        }
                        i++;
                    }; 
                    //small rectangle with display of street size
                    ctx.font = "12px Arial";
                    ctx.fillStyle = 'grey';
                    ctx.textAlign = 'center';
                    ctx.fillText((size / 100).toFixed(2) + ' m', middle * ratio, y - 2);
                };
                
                //setLineDash deactivated, because of incompatibilities with Firefox!!
                //draws the metric scale on top of the canvas
                //draws a grid, if showRaster
                this.drawInfoLine = function(segmentViewList){  
                    var originY = this.canvas.height - 50;
                    var ctx = this.canvas.getContext("2d");
                    //clear lower area
                    ctx.clearRect(0, originY, 
                                  this.canvas.width, 50);
                    var segmentView = {left: 0,
                                       width: 0,
                                       next: segmentViewList.first};
                    while(segmentView){                        
                        var next = (segmentView.next && segmentView.next.isConnector) ? segmentView.next.next: segmentView.next;
                        var y = originY + 12.5;                        
                        ctx.lineWidth = 1;                        
                        ctx.font = "bold 12px Arial";
                        ctx.strokeStyle = 'black';

                        //horizontal line
                        ctx.beginPath();
                        var segRight = segmentView.left + segmentView.width;
                        //ctx.setLineDash([5]);
                        ctx.moveTo(segmentView.left, y);
                        ctx.lineTo(segRight, y); 
                        ctx.stroke();    

                        //vertical lines
                        ctx.beginPath();
                       // ctx.setLineDash([1,2]);
                        ctx.moveTo(segmentView.left, y);
                        ctx.lineTo(segmentView.left, originY); 
                        ctx.moveTo(segRight, y);
                        ctx.lineTo(segRight, originY); 
                        ctx.stroke();                            

                        if (segmentView.width > 0){
                            //small rectangle with display of segmentsize inside
                            //in middle of horizontal line
                            ctx.beginPath();
                            var middle = segmentView.left + segmentView.width / 2;
                            ctx.rect(middle - 25 , y - 10, 50, 20);
                            ctx.fillStyle = 'white';
                            ctx.fill();
                            //ctx.setLineDash([0]);
                            ctx.stroke();
                            ctx.fillStyle = 'black';
                            ctx.textAlign = 'center';
                            var size = segmentView.segment.size;
                            ctx.fillText((size / 100).toFixed(2) + ' m', middle, y + 3);
                        }
                        //visualize gaps between segments
                        var nextLeft = (next) ? next.left: parseInt(this.parent.css('width'));
                        var thisRightPos = (segmentView.segment) ? (segmentView.segment.startPos + 
                                    segmentView.segment.size): 0;
                        var nextStartPos = (next) ? next.segment.startPos: this.streetSize;
                        var gap = nextLeft - segRight;
                        if (gap > this.gapTolerance){     
                            var middle = segRight + gap / 2;
                            ctx.beginPath();
                            //ctx.setLineDash([1, 2]);
                            ctx.strokeStyle = 'grey';
                            ctx.moveTo(segRight, y - 10);
                            ctx.lineTo(nextLeft, y - 10); 
                            ctx.moveTo(middle, y - 10);
                            ctx.lineTo(middle, y + 5); 

                            ctx.rect(middle - 25 , y + 5, 50, 20);
                            ctx.fillStyle = 'white';
                            ctx.fill();
                            ctx.stroke();
                            ctx.fillStyle = 'grey';
                            ctx.textAlign = 'center';
                            var gapSize = nextStartPos - thisRightPos;
                            ctx.fillText((gapSize / 100).toFixed(2) + ' m',  middle, y + 18);
                        };
                        
                        segmentView = next;
                    };              
                };
                                
                this.resize();
            },
            
            /**
            * the placeholder indicates, if a segment can be dropped or not
            * moves horizontally along with the dragged segment
            *
            * @param segmentViewList  the list of redner SegmentViews inside the parent container (most likely the editor)
            * @param parent           the container, the placeholder is rendered in (most likely the editor container)
            * @see                    a placeholder colored green if droppable or red if not droppable
            */ 
            Placeholder: function(segmentViewList, parent){
                this.parent = parent;
                this.segmentViewList = segmentViewList;
                this.active = false;
                this.left = 0;
                this.div = null;
                this.cid = null;
                this.isConnector;
                this.snapTolerance = 20;
                //offset of the dragged helper to the placeholder while dragging
                this.offsetX = -20;
                this.droppable = true;

                //moves the placeholder to the given position
                //param left is the position inside the parent container (in pixel)
                this.updatePos = function(left){
                    if (this.active){
                        left += this.offsetX;
                        left -= this.parent.offset().left;
                        //prevent overlapping the borders
                        var minLeft = 0;//parent.offset().left;
                        var maxLeft = minLeft + 
                                      parseInt(parent.css('width')) -
                                      parseInt($(this.div).css('width'));                              
                        if (left <= minLeft)
                            left = minLeft;                                
                        else if (left >= maxLeft)
                            left = maxLeft;
                        //snap to grid based on steps     
                        //left -= (left % this.segmentViewList.steps * this.segmentViewList.pixelRatio); 
                        this.left = left; 
                        $(this.div).css('left', left);
                        var gap = this.segmentViewList.doesFit(this.div, 
                            this.isConnector);
                        //flag as not droppable if collision to neighbours 
                        //is detected
                        if (!gap.fits){
                            this.droppable = false;
                            $(this.div).addClass('blocked');
                        }
                        //flag as droppable, 
                        //snap the placeholder to other segments
                        else {
                            this.droppable = true;
                            $(this.div).removeClass('blocked');
                        };                        
                        //take shortest distance to next segment
                        var snap = (gap.left < gap.right) ? -gap.left: gap.right;
                        //shift the placeholder, if distance is shorter 
                        //than the defined snap tolerance
                        if (Math.abs(snap) < this.snapTolerance){
                            this.left += snap;
                            $(this.div).css('left', this.left);
                        };
                    }
                };

                //activate the placeholder
                this.setActive = function(active, clone, width){
                    this.active = active;
                    //remove placeholder if deactivated
                    if (!active)
                        $(this.div).remove();
                    //create placeholder on position of given div
                    //offset: if zoomed in clone (appended to body)
                    //has different position left than dragged div
                    else if (clone){
                        this.isConnector = clone.data('isConnector');
                        //update the positions of the other divs
                        this.cid = clone.data('segmentViewID');  
                        var left = clone.position().left;
                        var width = (width) ? width: clone.css('width');
                        this.div = $(document.createElement('div'));  
                        $(this.div).css('width', width);
                        $(this.div).css('height', parent.css('height'));
                        $(this.div).addClass('placeholder');
                        $(this.div).data('segmentViewID', this.cid);
                        parent.append(this.div);
                        this.updatePos(left);
                    }
                };                               
            },
                                    
            clear: function(){
                 this.segmentViewList.clear();
                 this.collection.reset();
            },
                        
            resetToDefault: function(){
                this.clear();
                this.collection.fetch({reset:true});
            },
            
            //render the street profile
            renderEdition: function(){
                var _this = this;
                var height = parseInt(this.$el.css('height'));
                var ratio = this.pixelRatio();
                this.collection.each(function(segment){
                    var segmentView = new SegmentView({el: _this.el,
                                                       segment: segment,
                                                       height: height,
                                                       steps: _this.steps,
                                                       adminMode: _this.adminMode,
                                                       thumbSize: _this.thumbSize,
                                                       pixelRatio: ratio,
                                                       images: _this.images,
                                                       pngPreferred: this.pngPreferred
                                                       });
                    segmentView.render();
                    _this.segmentViewList.insert(segmentView);
                });
            },
            
            //calculate the pixel/metric ratio
            pixelRatio: function(){
                return parseInt($(this.$el[0]).css('width')) / 
                    this.streetSize;
            },
            
            //render the sliders to zoom and to change width of the street
            renderControls: function(){ 
                var _this = this;
                var editorWrapper = $("#editorWrapper" );
                editorWrapper.css( "overflow", "hidden" );
                $('.fadeControl').css('height', this.$el.height());
                var left = editorWrapper.offset().left;
				var scrolling = false;
				
                $('#rightFade').mousedown(function(){startScrolling('right');})
					.mouseover(function(){startScrolling('right');});;
                $('#leftFade').mousedown(function(){startScrolling('left');})
					.mouseover(function(){startScrolling('left');});
				$('.fadeControl').mouseup(function(){stopScrolling();})
					.mouseout(function(){stopScrolling();});
                updateScrollControls();   

				function startScrolling(direction){
					if (!scrolling){
						scrolling = true;
						var editorPos = _this.$el.css( "margin-left" ) === "auto" ? 0 :
							parseInt( _this.$el.css( "margin-left" ) ); 
						var overflow = _this.$el.width() - editorWrapper.width(); 
						var prefix = direction === 'right' ? '-=': '+=';
						var pixel = direction === 'right' ? overflow: Math.abs(editorPos);
						_this.$el.animate({"margin-left": prefix + pixel}, 2000);
					}
				};
				
				function stopScrolling(){
					_this.$el.stop();
					scrolling = false;
					updateScrollControls();
				};
			
				function updateScrollControls(){  
					//var editorWrapper = $("#editorWrapper" );
					var overflow = _this.$el.width() - editorWrapper.width(); 					
					$(".fadeControl").hide();    
					var editorPos = _this.$el.css( "margin-left" ) === "auto" ? 0 :
						parseInt( _this.$el.css( "margin-left" ) );  
					if(-editorPos > 0)
						$('#leftFade').show()  
					if(-editorPos < overflow)
						$('#rightFade').show()  					
				};				
                                
                $('#zoomSlider').slider({
                    value: _this.zoom,
                    step: 10,
                    min: 50,
                    max: 200,
                    animate: true,
                    slide: function (e, ui) {
                        $( "#zoomLable" ).text( ui.value );
                    },
                    change: function(e, ui){
                        var currentWidth = parseInt(_this.$el.css('width'));
                        var unzoomedWidth = currentWidth * 100 / _this.zoom;
                        _this.zoom = ui.value;                        
                        _this.$el.css('width', unzoomedWidth * _this.zoom/100);                        
                        _this.segmentViewList.changeScale(_this.pixelRatio()); 
                        updateScrollControls();
                    }
                });
                $("#zoomLable").text($('#zoomSlider').slider( "value" ));  
                
                if (this.adminMode){
                    $('#changeWidth').show();
                    $('#scaleSlider').slider({
                        value: _this.streetSize,
                        step: 5,
                        min: 1000,
                        max: 10000,
                        animate: true,
                        slide: function (e, ui) {
                            $("#scaleLable").text( ui.value / 100 + 'm');
                        },
                        change: function(e, ui){                            
                            _this.streetSize = ui.value;
                            _this.measure.streetSize = ui.value;
                            _this.segmentViewList.changeScale(_this.pixelRatio());  
                            updateScrollControls();
                        }
                    });
                    $("#scaleLable").text($('#scaleSlider').slider("value")/ 100 + 'm');
                }
                else
                    $('#changeWidth').hide();
            },
            
            //remove the view
            close: function () {
                this.segmentViewList.clear();
                this.unbind(); // Unbind all local event bindings
                this.collection.unbind();
                this.remove(); // Remove view from DOM
            }
                 
        });
        // Returns the View class
        return EditorView;

    }

);