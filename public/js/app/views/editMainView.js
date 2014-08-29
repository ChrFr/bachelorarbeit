// editView.js
// edit Window containing view on resources and the editor
// -------
define(["jquery", "backbone", "text!templates/editMain.html", 
    "views/sourceView", "views/editorView"],

    function($, Backbone, template, SourceView,
             EditorView){

        var EditMainView = Backbone.View.extend({

            // The DOM Element associated with this view
            el: "#mainFrame",

            // View constructor
            initialize: function(options) {
                var options = options || {};
                this.resources = options.resources;  
                this.edition = options.edition;
                this.images = options.images;  
                // Calls the view's render method
                this.render();    
                
                this.editorView = new EditorView({collection: this.edition,
                                                  el: '#editor',
                                                  resources: this.resources,
                                                  wrapper: "#editorWrapper",
                                                  images: this.images});
                this.resourcesView = new SourceView({collection: this.resources,
                                                     el: '#resources',
                                                     images: this.images});
                                                     //target: '#editor'
                this.resources.fetch({reset: true});

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
                // Maintains chainability
                return this;

            },            

        });

        // Returns the View class
        return EditMainView;

    }

);