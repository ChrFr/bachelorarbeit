// editView.js
// edit Window containing view on resources and the editor
// -------
define(["jquery", "backbone", "text!templates/editMain.html", 
    "edittool/js/jquery.shapeshift.adapted", "collections/SegmentSource",
    "views/sourceView"],

    function($, Backbone, template, shapeshift, SegmentSource, SourceView){

        var editView = Backbone.View.extend({

            // The DOM Element associated with this view
            el: "#mainFrame",

            // View constructor
            initialize: function(resources) {
                
                this.resources = resources;    
                this.resourcesView = new SourceView({collection: resources,
                                                     el: '#resources'});
                this.resources.fetch({reset: true});

                // Calls the view's render method
                this.render();               

            },

            // View Event Handlers
            events: {

            },

            // Renders the view's template to the UI
            render: function() {     
                 
                // Setting the view's template property using the Underscore template method
                this.template = _.template(template, {});
                
                // Dynamically updates the UI with the view's template
                this.$el.html(this.template);                
                
                $(".droparea").shapeshift({
                  colWidth: 1,
                  gutterX: 0,
                  minColumns: 1000,
                  minHeight: 480,
                  editTool: {
                      enabled: true
                  },
                  //maxHeight: 500,
                  autoHeight: false,
                  align: "left"
                }); 
                $(".trash").shapeshift({
                  autoHeight: false,
                  colWidth: 1,
                  enableTrash: true
                });
                // Maintains chainability
                return this;

            }

        });

        // Returns the View class
        return editView;

    }

);