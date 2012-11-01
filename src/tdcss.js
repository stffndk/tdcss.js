(function($){
    "use strict";

    $.fn.tdcss = function( options ) {

        var settings = $.extend({
                fragment_types: {
                    section: {identifier: "#"},
                    snippet: {identifier: ":"},
                    description: {identifier: "&"}
                },
                fragment_info_splitter: ";"
            }, options),
            module = {
                container: null,
                fragments: []
            };

        return this.each(function(i){

            module.container = this;

            reset();
            setup();
            parse();
            render();
            bindSectionCollapseHandlers();
            restoreCollapsedStateFromUrl();

            window.tdcss = window.tdcss || [];
            window.tdcss[i] = module;

        });

        function reset() {
            module.fragments.length = 0;
        }

        function setup() {
            $(module.container)
                .addClass("tdcss-fragments")
                .after("<div class='tdcss-elements'></div>");
        }

        function parse() {
            var comments = $(module.container).contents().filter(
                function() {
                    return this.nodeType === 8;
                }
            );

            comments.each(function(){
                module.fragments.push( new Fragment(this) );
            });
        }

        function Fragment(raw_comment_node) {
            var that = this;

            that.raw_comment_node = raw_comment_node;
            that.type = getFragmentType();

            if (that.type === "section") {
                that.section_name = $.trim( getCommentMeta(that.raw_comment_node)[0]
                    .split(settings.fragment_types.section.identifier)[1] );
            }

            if (that.type === "description") {
                that.description_text = $.trim( getCommentMeta(that.raw_comment_node)[0]
                    .split(settings.fragment_types.description.identifier)[1] );
            }

            if (that.type === "snippet") {
                that.snippet_title = $.trim( getCommentMeta(that.raw_comment_node)[0]
                    .split(settings.fragment_types.snippet.identifier)[1] );
                that.custom_height = $.trim( getCommentMeta(that.raw_comment_node)[1] );
                that.html = getFragmentHTML(that.raw_comment_node);
            }

            return that;

            function getFragmentType() {
                var found_type = "";
                for (var fragment_type in settings.fragment_types) {
                    if (settings.fragment_types.hasOwnProperty(fragment_type)) {
                        var identifier = settings.fragment_types[fragment_type].identifier;
                        if ( that.raw_comment_node.nodeValue.match( new RegExp(identifier) ) ) {
                            found_type = fragment_type;
                        }
                    }
                }
                return found_type;
            }
        }

        function getCommentMeta(elem) {
            return elem.nodeValue.split(settings.fragment_info_splitter);
        }

        function getFragmentHTML(elem) {
            // The actual HTML fragment is the comment's nextSibling (a carriage return)'s nextSibling:
            var fragment = elem.nextSibling.nextSibling;

            // Check if nextSibling is a comment or a real html fragment to be rendered
            if (fragment.nodeType !== 8) {
                return fragment.outerHTML;
            } else {
                return null;
            }
        }

        function render() {
            for (var i = 0; i < module.fragments.length; i++) {
                var fragment = module.fragments[i];

                if (fragment.type === "section") {
                    addNewSection(fragment.section_name);
                }

                if (fragment.type === "snippet") {
                    addNewSnippet(fragment);
                }

                if (fragment.type === "description") {
                    addNewDescription(fragment);
                }
            }
        }

        function addNewSection(section_name) {
            $(module.container).next(".tdcss-elements").append('<div class="tdcss-section" id="' + encodeURIComponent(section_name) + '"><h2 class="tdcss-h2">' + section_name + '</h2></div>');
        }

        function addNewSnippet(fragment) {
            var title = fragment.snippet_title || '',
                html = fragment.html,
                height = getFragmentHeightCSSProperty(fragment),
                $row = $("<div style='height:" + height + "' class='tdcss-fragment'></div>"),
                $dom_example = $("<div class='tdcss-dom-example'>" + html + "</div>"),
                $code_example = $("<div class='tdcss-code-example'><h3 class='tdcss-h3'>" + title + "</h3><textarea class='tdcss-textarea' readonly>" + html + "</textarea></div>");

            $row.append($dom_example, $code_example);
            $(module.container).next(".tdcss-elements").append($row);
            adjustCodeExampleHeight($row);

            function getFragmentHeightCSSProperty(fragment) {
                if (fragment.custom_height) {
                    return fragment.custom_height;
                } else {
                    return "auto";
                }
            }

            function adjustCodeExampleHeight($row) {
                var h3 = $(".tdcss-h3", $row),
                    textarea = $(".tdcss-textarea", $row),
                    new_textarea_height = $row.outerHeight(false) - h3.outerHeight(true)*2; //TODO: Eliminate magic number.

                textarea.height(new_textarea_height);
            }
        }

        function addNewDescription(fragment) {
            var description = $("<div class='tdcss-description'>" + fragment.description_text + "</div> ");
            $(module.container).next(".tdcss-elements").append(description);
        }

        function bindSectionCollapseHandlers() {
            $.fn.makeCollapsible = function() {
                var that = this;
                return that.each(function(){
                    var that = this;
                    that.header_element = $(that);
                    that.state_string = $(that).attr("id") + ";";
                    that.collapsed = false;
                    that.fragments_in_section = that.header_element.nextUntil(".tdcss-section");

                    that.toggle = function() {
                        that.collapsed = that.collapsed ? false : true;

                        if (that.collapsed) {
                            $(that.header_element).addClass("is-collapsed");
                            $(that.fragments_in_section).hide();
                            that.setCollapsedStateInUrl();
                        } else {
                            $(that.header_element).removeClass("is-collapsed");
                            $(that.fragments_in_section).show();
                            that.removeCollapsedStateFromUrl();
                        }
                    };

                    that.setCollapsedStateInUrl = function() {
                        var current_hash = window.location.hash;
                        if (current_hash.indexOf(that.state_string) === -1) {
                            window.location.hash = current_hash + that.state_string;
                        }
                    };

                    that.removeCollapsedStateFromUrl = function() {
                        window.location.hash = window.location.hash.replace(that.state_string, "");
                    };



                    $(that.header_element).on("click", function(){
                        that.toggle();
                    });

                    return that;
                });
            };

            $(".tdcss-section").makeCollapsible();
        }

        function restoreCollapsedStateFromUrl() {
            if (window.location.hash) {
                var hash = window.location.hash.split("#")[1],
                    collapsedSections = hash.split(";");

                for (var section in collapsedSections) {
                    if (collapsedSections.hasOwnProperty(section)) {
                        if (collapsedSections[section].length) {
                            var matching_section = document.getElementById(collapsedSections[section]);
                            $(matching_section).click(); //TODO: Using click() smells a little. Find a better way.
                        }
                    }
                }
            }
        }
    };
})($);



