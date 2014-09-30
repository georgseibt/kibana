/** @scratch /panels/5
 *
 * include::panels/network.asciidoc[]
 */

/** @scratch /panels/network/0
 *
 * == network
 * Status: *Stable*
 *
 * A network based on the results of an Elasticsearch term facet.
 *
 */

define([
    'angular',
    'app',
    'lodash',
    'jquery',
    'kbn'],

    function (angular, app, _, $, kbn) {

        'use strict';

        var module = angular.module('kibana.panels.network', []);
        app.useModule(module);

        module.controller('network', function ($scope, querySrv, dashboard, filterSrv, fields) {
            //in this function all the magic happens

            $scope.panelMeta = {
                modals: [
                    {
                        description: "Inspect",
                        icon: "icon-info-sign",
                        partial: "app/partials/inspector.html",
                        show: $scope.panel.spyable
                    }
                ],
                editorTabs: [
                    {
                        title: 'Queries', src: 'app/partials/querySelect.html'
                    }
                ],
                status: "Stable",
                description: "Displays the results of an elasticsearch facet as a pie chart, bar chart, or a " +
                    "table"
            };

            // Set and populate defaults
            var _d = {
                /** @scratch /panels/network/5
                * === Parameters
                *
                * field:: The field on which to computer the facet
                */
                field   : '_type',
                /** @scratch /panels/network/5
                * exclude:: network to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/network/5
                * size:: Show this many network
                */
                size: 10,
                /** @scratch /panels/chord/5
                * === Parameters
                *
                * seperator:: The character which divides the column for the connections
                */
                seperator: '-',
                /** @scratch /panels/network/5
                * order:: In network mode: count, term, reverse_count or reverse_term,
                * in network_stats mode: term, reverse_term, count, reverse_count,
                * total, reverse_total, min, reverse_min, max, reverse_max, mean or reverse_mean
                */
                order   : 'count',
                /** @scratch /panels/network/5
                * arrangement:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/network/5
                * counter_pos:: The location of the legend in respect to the chart, above, below, or none.
                */
                counter_pos: 'above',
                /** @scratch /panels/network/5
                * nodesize:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                nodesize: 'outgoing',
                /** @scratch /panels/network/5
                * tooltips:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                tooltipsetting: 'true',
                /** @scratch /panels/network/5
                * colorcode:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                colorcode: 'coloured',
                /** @scratch /panels/network/5
                * direction:: defines if the paths in the network should be directed or undirected
                */
                direction: 'directed',
                /** @scratch /panels/network/5
                * charge:: defines the charge for the forced layout network
                */
                charge: -300,
                /** @scratch /panels/network/5
                * spyable:: Set spyable to false to disable the inspect button
                */
                spyable     : true,
                /** @scratch /panels/network/5
                *
                * ==== Queries
                * queries object:: This object describes the queries to use on this panel.
                * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
                * queries.ids::: In +selected+ mode, which query ids are selected.
                */
                queries     : {
                    mode        : 'all',
                    ids         : []
                }
            };

            _.defaults($scope.panel, _d);

            $scope.init = function () {
                $scope.hits = 0;    //This is just done when the page is first started
                $scope.$on('refresh', function () {
                    //this part of the code is done if the refresh symbol in the header is clicked
                    $scope.get_data();
                });
                $scope.get_data();  //This is done when the page is started
            };

            $scope.get_data = function () {
                // Make sure we have everything for the request to complete
                if (dashboard.indices.length === 0) {
                    return;
                }
                $scope.panelMeta.loading = true;
                var request,
                    results,
                    boolQuery,
                    queries;

                $scope.field = _.contains(fields.list, $scope.panel.field + '.raw') ?
                    $scope.panel.field + '.raw' : $scope.panel.field;

                request = $scope.ejs.Request().indices(dashboard.indices);

                $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
                queries = querySrv.getQueryObjs($scope.panel.queries.ids);

                // This could probably be changed to a BoolFilter
                boolQuery = $scope.ejs.BoolQuery();
                _.each(queries, function (q) {
                    boolQuery = boolQuery.should(querySrv.toEjsObj(q));
                });
                /*
                Different parts of the request are sticked together: from where the data should be,
                different filters and queries, etc.
                This is saved in the variable 'request'
                */
                request = request
                    .facet(
                        $scope.ejs.TermsFacet('terms')
                        .field($scope.field)
                        .size($scope.panel.size)
                        .order($scope.panel.order)
                        .exclude($scope.panel.exclude)
                        .facetFilter(
                            $scope.ejs.QueryFilter(
                                $scope.ejs.FilteredQuery(
                                    boolQuery,
                                    filterSrv.getBoolFilter(filterSrv.ids())
                                )
                            )
                        )
                    ).size(0);


                // Populate the inspector panel; The current request will be shown in the inspector panel
                $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

                // Populate scope when we have results
                results = request.doSearch().then(function (results) {
                    $scope.panelMeta.loading = false;
                    $scope.hits = results.hits.total;
                    
                    $scope.results = results;
                    

                    $scope.$emit('render'); //dispatches the event upwards through the scope hierarchy of controllers.
                });
            };

            $scope.build_search = function (nodeName) {
                //This function filters the result. If you click on a node (border segment of the circle), just the Connections to and from this node are shown
                var queryterm = "";
                $scope.data.forEach(function (d) {
                    if (d.label.indexOf(nodeName) > -1) {
                        if (queryterm === "") {
                            queryterm = queryterm + "" + $scope.field + ":\"" + d.label +"\""
                        }
                        else {
                            queryterm = queryterm + " OR " + $scope.field + ":\"" + d.label+"\""
                        }
                    }
                })
                filterSrv.set({
                    type: 'querystring', query: queryterm,
                    mandate: 'must'
                });
            };

            $scope.seperateRelation = function (text) {
                var splittedRelation = text.split($scope.panel.seperator);
                return splittedRelation;
            }

            $scope.get_details = function (nodeName) {
                var links = [];
                $scope.links.forEach(function (d) {
                    if (d.relation.indexOf(nodeName) > -1) {
                        links.push(d);
                    }
                })
                links.sort(function (a, b) {
                    if (a.relation < b.relation)
                        return -1;
                    if (a.relation > b.relation)
                        return 1;
                    return 0;
                })
                return links;
            }

            $scope.get_detailsOnNode = function (nodeID) {
                var nodeName = $scope.uniqueNodes[nodeID].name;
                var links = [];

                $scope.data.forEach(function (d) {
                    if (d.label.indexOf(nodeName) > -1) {
                        var object = {
                            "source_color": $scope.uniqueNodes.filter(function (obj) {
                                return obj.name === $scope.seperateRelation(d.label)[0]; //=sourceName
                            })[0].color,
                            "target_color": $scope.uniqueNodes.filter(function (obj) {
                                return obj.name === $scope.seperateRelation(d.label)[1]; //=targetName
                            })[0].color,
                            "label": d.label,
                            "data": d.data,
                            "sum": 0
                        }
                        links.push(object);
                    }
                })
                links.sort(function (a, b) {
                    if (a.label < b.label)
                        return -1;
                    if (a.label > b.label)
                        return 1;
                    return 0;
                })
                return links;
            }

            $scope.get_detailsOnChord = function (sourceID, targetID) {
                var obj = $scope.data.filter(function (obj) {
                    return obj.label === $scope.uniqueNodes[sourceID].name + $scope.panel.seperator + $scope.uniqueNodes[targetID].name;
                });
                if (typeof obj[0] === 'undefined') {
                    return null;
                }
                else {
                    var source_color = $scope.uniqueNodes[sourceID].color;
                    var target_color = $scope.uniqueNodes[targetID].color;
                    var label = $scope.uniqueNodes[sourceID].name + "" + $scope.panel.seperator + "" + $scope.uniqueNodes[targetID].name;

                    var data = obj[0].data;
                    var object = {
                        "source_color": source_color,
                        "target_color": target_color,
                        "label": label,
                        "data": data
                    }
                    return object;
                }
            }





            $scope.set_refresh = function (state) {
                //This function is executed if some changes are done in the editor
                $scope.refresh = state;
            };

            $scope.close_edit = function () {
                //This function is executed if the editor is closed
                //The data are loaded again
                if ($scope.refresh) {
                    $scope.get_data();
                }
                $scope.refresh = false;
                $scope.$emit('render');
            };
            
            $scope.show_tooltip = function (duration, opacity, text, pos_left, pos_top) {
                //$scope.tooltip = d3.select("#details");
                $scope.tooltip.transition()
                    .duration(duration)
                    .style("opacity", opacity);
                $scope.tooltip.html(text);
                //$scope.tooltip.style("left", pos_left + "px")
                //    .style("top", pos_top + "px");
            }

            $scope.hide_tooltip = function (duration, opacity) {
                $scope.tooltip.transition()
                    .duration(duration)
                    .style("opacity", opacity);
            }
        });

        module.directive('networkChart', function (querySrv) {
            return {
                restrict: 'A',
                link: function (scope, elem) {
                    var plot;

                    // Receive render events
                    scope.$on('render', function () {
                        render_panel();
                    });

                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the network diagram are now saved in the array 'scope.data'
                        scope.data = [];
                        _.each(scope.results.facets.terms.terms, function (v) {
                            var slice;
                            slice = { label: v.term, data: v.count, color: querySrv.colors[k] };
                            
                            scope.data.push(slice);
                            k = k + 1;
                        });
                    }

                    // Function for rendering panel
                    function render_panel() {
                        var chartData;

                        build_results();

                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });

                        // Make a clone we can operate on.
                        chartData = _.clone(scope.data);
                        createNetworkDiagram(scope, chartData);
                    }
                }
            };

            function createNetworkDiagram(scope, dataset) {
                $('#networkGraphic').empty();  //removes all elements from the div with the id 'graphic'

                var dataset, svg, force,
                    margin = { top: -5, right: -5, bottom: -5, left: -5 },
				max_value = 0,
				max_radius_out = 0,
				max_radius_in = 0,
				max_radius_undirected = 0,
				frame_width = 560,
				frame_height = 500,
				node_radius = 5,
				arrowhead_length = 10,
				node_highlighter = scope.panel.nodesize,
				linkedByIndex = {};

                //Define the required layout
                svg = d3.select("#networkGraphic")
                    .append("svg")
                    .attr("width", frame_width)
                    .attr("height", frame_height);



                force = d3.layout.force()
                    .gravity(0)
                    .charge(scope.panel.charge)
                    .linkDistance(200)
//                  .linkDistance(function(d) { return radius(d.source.size) + radius(d.target.size) + 20; }) //linkdistance can be individual
                    .size([frame_width, frame_height]);

                //define tooltip
                scope.tooltip = d3.select("#details")
                    .style("opacity", 0);
                //scope.tooltip = d3.select("body").append("div")
                //    .attr("class", "tooltip")
                //    .style("opacity", 0);

                //Build the network                        
                dataset = prepareDataset(dataset); //before invoking this function the dataset is the the data how it came from the datastore
                drawNetwork(dataset);
                                
                function defineArrows() {
                    // build the arrow.
                    svg.append("defs")
                        .selectAll("marker")
                        .data(["end"])      // Different link/path types can be defined here
                        .enter()
                        .append("marker")    // This section adds in the arrows
                        .attr("id", String)
                        .attr("viewBox", "0 -5 10 10")
                        .attr("refX", 10)	//defines how far the marker is away from the end of the path
                        .attr("refY", 0)
                        .attr("markerWidth", arrowhead_length)
                        .attr("markerHeight", arrowhead_length)
                        .attr("markerUnits", "userSpaceOnUse")	//this line makes the marker size independent of the path stroke-width
                        .attr("orient", "auto")
                        .attr("class","marker")
                        .append("svg:path")
                        .attr("d", "M0,-5L10,0L0,5");
                }

                function drawNetwork(dataset) {
                    //dataset is an object with two attributes: nodes and links. Each attribute consists of an array
                    defineArrows();
                    dataset.links.forEach(function (link) {
                        max_value = Math.max(max_value, link.value); //find maximum of value in all edges
                        linkedByIndex[link.source + "," + link.target] = 1;
                    });
                    dataset.nodes.forEach(function (node) {
                        max_radius_out = Math.max(max_radius_out, node.radius_out); //find maximum of value in all edges
                        max_radius_in = Math.max(max_radius_in, node.radius_in); //find maximum of value in all edges
                        max_radius_undirected = Math.max(max_radius_undirected, (node.radius_in + node.radius_out)); //find maximum of value in all edges
                    });

                    force.nodes(dataset.nodes)
                            .links(dataset.links)
                            .on("tick", tick)
                            .start();

                    // add the links and the arrows
                    var path = svg.append("g").selectAll("path")
                        .data(force.links())
                        .enter()
                        .append("path")
                        .attr("class", "link")
                        .attr("id", function (d, i) { return "linkId_" + i; })
                        .style("stroke-width", function (d) { return (d.value / max_value) * 5; }) //the width of the path is scaled on a scale from 0 to 5
                        .on("mouseover", function (d) {
                            //show tooltip when hovering over chords
                            var detailstext = "";
                            var details = [];
                            details.push(scope.get_detailsOnChord(d.source.index, d.target.index));
                            if (scope.panel.direction != "directed")
                                details.push(scope.get_detailsOnChord(d.target.index, d.source.index));

                            //creation of detailstext for the directed graph
                            var sum = 0;
                            details.forEach(function (d) {
                                if (d != null) {
                                    detailstext = detailstext + (kbn.query_color_dot(d.source_color, 15) + kbn.query_color_dot(d.target_color, 15) + ' ' + d.label + " (" + d.data + ")<br/>");
                                    sum = sum + d.data;
                                }
                            })

                            if (scope.panel.direction != "directed") {
                                detailstext = detailstext + 'Sum: ' + sum;
                            }





                            //show tooltip
                            //if (scope.panel.direction === "directed") {
                            //    var detailstext = kbn.query_color_dot(d.color, 15) + " " + d.relation + " (" + d.value+")";
                            //}
                            //else {
                            //    var detailstext = "BETWEEN : " + kbn.query_color_dot(d.source.color, 15) + " " + d.source.name +
                            //        "<br/>AND: " + kbn.query_color_dot(d.target.color, 15) + " " + d.target.name +
                            //        "<br/>COUNT: " + d.value;
                            //}
                            if (scope.panel.tooltipsetting) {
                                scope.show_tooltip(100, 0.9, detailstext, d3.event.pageX + 30, d3.event.pageY);
                            }
                        })
                        .on("mouseout", function (d) {
                            scope.hide_tooltip(100, 0);
                        });
                    if (scope.panel.direction === "directed") {
                        path.attr("marker-end", "url(#end)");
                    }

                    // define the nodes
                    var node = svg.selectAll(".node")
                        .data(force.nodes())
                        .enter()
                        .append("g")
                        .attr("class", "node")
                        .style("fill", function (d) { return d.color; })
                        .on("mouseover", fade(0.1))
                        .on("mouseout", fade(1.0))
                        .on("click", function (d) {
                            //if clicking on a node, the dataset is filtered for this node. All other nodes are not shown anymore. The data is also filtered for the other graphics
                            if (!d3.event.ctrlKey) //node is only filtered if ctrl Key is NOT pressed
                                scope.build_search(d.name);

                            scope.hide_tooltip(100, 0);
                        })
                        .call(force.drag);

                    // add the nodes
                    node.append("circle")
                        .attr("r", function (d) {
                            if (scope.panel.direction === "directed") {
                                if (node_highlighter == 'outgoing') { return d.radius_out / max_radius_out * 10 + 5; }
                                else { return d.radius_in / max_radius_in * 10 + 5; }
                            }
                            else {
                                return (d.radius_in + d.radius_out) / max_radius_undirected * 10 + 5;
                            }

                        })
                        .style("stroke", function (d) { if(scope.panel.colorcode==="black-white"){return "black";} else{ return d.color;} })
                        .style("stroke-width", "2px");
                    // add the text 
                    node.append("text")
                        .attr("class","linklabel")
                        .attr("x", 12)
                        .attr("dy", ".35em")
                        .text(function (d) { return d.name; });

                    // add the curvy lines
                    function tick() {
                        path.attr("d", linkArc);
                        node.attr("cx", function (d) { return d.x = Math.max(50, Math.min(560 - 50, d.x)); })
                            .attr("cy", function (d) { return d.y = Math.max(50, Math.min(500 - 50, d.y)); });
                        node.attr("transform", transform);
                    }

                    function isConnected(a, b) {
                        return ((linkedByIndex[a.index + "," + b.index] || linkedByIndex[b.index + "," + a.index] || a == b) == 1);
                    }
                    
                    function fade(opacity) {
                        /*
                        This function determines if two nodes are connected or not. If the user has selected a node by clicking on it (variable: selected_node),
                        the function checks which other nodes are connected to the selected node. This check is done by the function isConnected(). If the nodes
                        are connected the node and the connection between the nodes stay visible.
                        */
                        return function (selected_node) {
                            var details = scope.get_detailsOnNode(selected_node.index);
                            //show tooltip when hovering over node
                            var detailstext = selected_node.name + "<br/><br/>"
                            details.forEach(function (d) {
                                detailstext = detailstext + (kbn.query_color_dot(d.source_color, 15) + kbn.query_color_dot(d.target_color, 15) + ' ' + d.label + " (" + d.data + ")<br/>");
                            })

                            //var details = scope.get_details(selected_node.index);
                            //var detailstext = ""
                            //details.forEach(function (d) {
                            //    detailstext = detailstext + (kbn.query_color_dot(d.color, 15) + ' ' + d.relation + " (" + d.value + ")<br/>");
                            //})
                            if (scope.panel.tooltipsetting && opacity<1) {
                                scope.show_tooltip(100, 0.9, detailstext, d3.event.pageX + 30, d3.event.pageY - 60);
                            }
                            else {
                                scope.hide_tooltip(100, 0);
                            }
                            node.style("stroke-opacity", function (connected_nodes) {
                                var thisOpacity = isConnected(selected_node, connected_nodes) ? 1 : opacity;
                                this.setAttribute('fill-opacity', thisOpacity);
                                return thisOpacity;
                            });

                            path.style("opacity", function (connected_nodes) {
                                return connected_nodes.source === selected_node || connected_nodes.target === selected_node ? 1 : opacity;
                            });
                            scope.selectedNode = selected_node.name;
                        };                        
                    }                   

                    //function linkArc2(d) {
                    //    if (scope.panel.direction === "directed") {
                    //        //if the the grapgh is directed, the links are drawn as curved lines
                    //        var sx = d.source.x;
                    //        var sy = d.source.y;
                    //        var tx = d.target.x;
                    //        var ty = d.target.y;
                    //        var nodeRadius;
                    //        if (node_highlighter == 'outgoing') { nodeRadius = d.target.radius_out / max_radius_out * 10 + 5; }
                    //        else { nodeRadius = d.target.radius_in / max_radius_in * 10 + 5; }
                    //        //					var nodeRadius=6;
                    //        var arrowheadLength = 0;
                    //        var dx = tx - sx,
                    //        dy = ty - sy,
                    //        dr = Math.sqrt(dx * dx + dy * dy);
                    //        var beta_angle = (nodeRadius + arrowheadLength) / dr; //(2*Math.PI)*nodeRadius/(2*dr*Math.PI);
                    //        var alpha1_angle = ((Math.PI - beta_angle) / 2) - Math.PI / 3;
                    //        var alpha2_angle = Math.atan(dx, dy);
                    //        var target_X = tx - Math.sin(alpha1_angle + alpha2_angle) * (nodeRadius + arrowheadLength);
                    //        var target_Y = ty;//-Math.cos(alpha1_angle+alpha2_angle)*(nodeRadius + arrowheadLength);
                    //        return "M" + sx + "," + sy + "A" + dr + "," + dr + " 0 0,1 " + target_X + "," + target_Y;
                    //    }
                    //    else {
                    //        //if graph is undirected, the links are drawn as straight lines
                    //        return "M" + d.source.x + "," + d.source.y + "A" + 0 + "," + 0 + " 0 0,1 " + d.target.x + "," + d.target.y;
                    //    }
                    //}

                    function linkArc(d) {
                        if (scope.panel.direction === "directed") {
                            //if the the grapgh is directed, the links are drawn as curved lines
                            var sx = d.source.x;
                            var sy = d.source.y;
                            var tx = d.target.x;
                            var ty = d.target.y;

                            var nodeRadius;
                            if (node_highlighter == 'outgoing') { nodeRadius = d.target.radius_out / max_radius_out * 10 + 5; }
                            else { nodeRadius = d.target.radius_in / max_radius_in * 10 + 5; }

                            if (sx > tx && sy > ty) { //target top left of source
                                sx = sx - nodeRadius+10;
                                sy = sy;
                                tx = tx;
                                ty = ty + nodeRadius;
                            }
                            if (sx < tx && sy > ty) { //target top right of source
                                sx = sx;
                                sy = sy - nodeRadius+10;
                                tx = tx - nodeRadius;
                                ty = ty;
                            }
                            if (sx < tx && sy < ty) { //target bottom right of source
                                sx = sx + nodeRadius-10;
                                sy = sy;
                                tx = tx;
                                ty = ty - nodeRadius;
                            }
                            if (sx > tx && sy < ty) { //target bottom left of source
                                sx = sx;
                                sy = sy + nodeRadius-10;
                                tx = tx + nodeRadius;
                                ty = ty;
                            }

                            var dx = tx - sx,
                            dy = ty - sy,
                            dr = Math.sqrt(dx * dx + dy * dy);
                            return "M" + sx + "," + sy + "A" + dr + "," + dr + " 0 0,1 " + tx + "," + ty;
                        }
                        else {
                            //if graph is undirected, the links are drawn as straight lines
                            return "M" + d.source.x + "," + d.source.y + "A" + 0 + "," + 0 + " 0 0,1 " + d.target.x + "," + d.target.y;
                        }
                    }

                    function transform(d) {
                        return "translate(" + d.x + "," + d.y + ")";
                    }
                }

                function prepareDataset(dataset) {
                    if (scope.panel.seperator === "") {
                        //if user enters space as seperator, the user interface ignores this value and leaves the variable blank.
                        //For that reason we catch this exception here and define the seperator as a space
                        scope.panel.seperator = " ";
                    }

                    var uniqueNodes = findUniqueNodes(dataset); //is a one dimensional array with all nodes
                    var nodesJSON = createNodeJSON(uniqueNodes);
                    var linksJSON = createLinkJSON(dataset, nodesJSON);
                    
                    nodesJSON.forEach(function (d) {
                        //define the radius_in and radius_out for each node
                        var nodeIndex = nodesJSON.map(function (e) { return e.name; }).indexOf(d.name);
                        d.radius_in = aggregateLinks("in", nodeIndex, linksJSON);
                        d.radius_out = aggregateLinks("out", nodeIndex, linksJSON);
                    });

                    scope.uniqueNodes = nodesJSON; //format: name, radius_out, radius_in, color

                    //console.log(scope.uniqueNodes);
                    //console.log(scope.links);
                    //console.log(scope.aggregatedLinks);

                    return { nodes: nodesJSON, links: linksJSON };
                                       
                    function aggregateLinks(aggregateType, nodeIndex, linksJSON) {
                        //aggregateType can be 'in' or 'out'. If 'in' all incoming values are aggregated, if 'out' all outgoing values are aggregated
                        var sum = 0;
                        if (aggregateType === "in") {
                            linksJSON.forEach(function (d) {
                                if (d.target === nodeIndex) {
                                    sum = sum + d.value;
                                }
                            });
                        }
                        if (aggregateType === "out") {
                            linksJSON.forEach(function (d) {
                                if (d.source === nodeIndex) {
                                    sum = sum + d.value;
                                }
                            });
                        }
                        else {

                        }
                        return sum;
                    }

                    function createNodeJSON(uniqueNodes) {  //creates a JSON file for all nodes with the attributes: name, radius_in, radius_out. When creating the file the values of radius_in, and radius_out are still empty. They are filled later.
                        var nodes = []; //create array with several objects of the nodes
                        var k = 0;
                        uniqueNodes.forEach(function (d) {
                            if (scope.panel.colorcode === "black-white") {
                                var colorcode = "white";
                            }
                            else {
                                var colorcode = querySrv.colors2[k];
                            }
                            var object = {
                                "name": d,
                                "radius_out": null,
                                "radius_in": null,
                                "color": colorcode
                            }
                            k = k + 1;
                            nodes.push(object);
                        });
                        return nodes;   //returns an array of all nodes as objects with the attributes: name, radius_out, radius_in. Till now the values of radius_in, and radius_out are still empty
                    }

                    function createLinkJSON(dataset, nodes) {   //creates a JSON file for all links, with the attributes: source, target, and value
                        var links = []; //creates array with several objects of the links
                        dataset.forEach(function (d) {
                            var object = {  //create an object for each link with the index of the node (NOT the name)
                                "relation": d.label,
                                "color": d.color,
                                "source": nodes.map(function (e) { return e.name; }).indexOf(scope.seperateRelation(d.label)[0]),
                                "target": nodes.map(function (e) { return e.name; }).indexOf(scope.seperateRelation(d.label)[1]),
                                "value": d.data
                            }
                            links.push(object);
                        }); //format: relation, source, target, color, value
                        if (scope.panel.direction === "directed") {
                            //the links are not aggregated. Values for A->B and B->A stay seperate records
                            return links;
                        }
                        else {
                            //we summarize the links, so that two relations like A->B and B->A are summarized to A->B
                            links.forEach(function (d) {
                                if (nodesJSON[d.source].name < nodesJSON[d.target].name) { }
                                else {
                                    var help = d.source;
                                    d.source = d.target;
                                    d.target = help;
                                    d.relation = nodesJSON[d.source].name + "" + scope.panel.seperator + "" + nodesJSON[d.target].name
                                }
                            })
                            links.sort(function (a, b) {
                                if (a.relation < b.relation)
                                    return -1;
                                if (a.relation > b.relation)
                                    return 1;
                                return 0;
                            })

                            var links = _.chain(links)
                                .groupBy("relation")
                                .map(function (value, key) {
                                    return {
                                        "relation": key,
                                        "color": _.pluck(value, "color")[0],
                                        "source": _.pluck(value, "source")[0],
                                        "target": _.pluck(value, "target")[0],
                                        "value": _.reduce(_.pluck(value, "value"), function (memo, num) { return memo + num; }, 0)
                                    }
                                })
                                .value();

                            //scope.aggregatedLinks = links; //scope variable where values from records with interchanges sources and targets are aggregated
                            return links; //format: relation, source, target, color, value
                        }
                    }

                    function findUniqueNodes(dataset) {
                        var nodes = [];  //create array for the nodes. Its just an array of strings. No objects or anything similar.

                        dataset.forEach(function (d) {
                            //seperates all nodes and stores them in the array 'nodes'
                            scope.seperateRelation(d.label).forEach(function (d) {
                                nodes.push(d);
                            });
                        });
                        var uniqueNodes = nodes.filter(onlyUnique); //all nodes in the array 'nodes' are filtered and only unique values remain

                        return uniqueNodes;
                    }

                    function onlyUnique(value, index, self) {
                        return self.indexOf(value) === index;
                    }
                }
            }
        });

    }
);
