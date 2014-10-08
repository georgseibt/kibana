/** @scratch /panels/5
 *
 * include::panels/hiveplot.asciidoc[]
 */

/** @scratch /panels/hiveplot/0
 *
 * == hiveplot
 * Status: *Stable*
 *
 * A hiveplot based on the results of an Elasticsearch term facet.
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

        var module = angular.module('kibana.panels.hiveplot', []);
        app.useModule(module);

        module.controller('hiveplot', function ($scope, querySrv, dashboard, filterSrv, fields) {
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
                description: "Displays the results of an elasticsearch facet as a hiveplot diagram"
            };

            // Set and populate defaults
            var _d = {
                /** @scratch /panels/hiveplot/5
                * === Parameters
                *
                * field:: The field on which to computer the facet
                */
                field   : '_type',
                /** @scratch /panels/hiveplot/5
                * exclude:: terms to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/hiveplot/5
                * size:: Show this many terms
                */
                size: 10,
                /** @scratch /panels/chord/5
                * === Parameters
                *
                * seperator:: The character which divides the column for the connections
                */
                seperator: '-',
                /** @scratch /panels/hiveplot/5
                * order:: How the terms are sorted: count, term, reverse_count or reverse_term,
                */
                order   : 'count',
                /** @scratch /panels/hiveplot/5
                * arrangement:: Arrangement of the legend: horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/hiveplot/5
                * counter_pos:: The location of the legend in respect to the diagram: above, below, or none.
                */
                counter_pos: 'above',
                /** @scratch /panels/hiveplot/5
                * nodesize:: Indicates if the size of the nodes (radius) should be proportional to the incoming, outgoing ot total number of edges
                */
                nodesize: 'outgoing',
                /** @scratch /panels/hiveplot/5
                * tooltipsetting:: Indicates if tooltips should be shown if the user hovers over a segment or chord
                */
                tooltipsetting: 'true',
                /** @scratch /panels/hiveplot/5
                * colorcode:: Indicates if the nodes should be coloured or black-white
                */
                colorcode: 'coloured',
                /** @scratch /panels/hiveplot/5
                * direction:: defines if the paths in the hiveplot should be directed or undirected
                */
                direction: 'directed',
                /** @scratch /panels/hiveplot/5
                * number_of_axis:: defines how many axis should be drawn in the hiveplot
                */
                number_of_axis: 2,
                /** @scratch /panels/hiveplot/5
                * axis1:: defines the label for axis1 and which nodes should be displayed on this axis (possible values are: 'source', 'target', 'time' and 'connection'
                */
                axis1: 'source',
                /** @scratch /panels/hiveplot/5
                * axis2:: defines the label for axis2 and which nodes should be displayed on this axis (possible values are: 'source', 'target', 'time' and 'connection'
                */
                axis2: 'target',
                /** @scratch /panels/hiveplot/5
                * axis3:: defines the label for axis3 and which nodes should be displayed on this axis (possible values are: 'source', 'target', 'time' and 'connection'
                */
                axis3: 'time',
                /** @scratch /panels/hiveplot/5
                * spyable:: Set spyable to false to disable the inspect button
                */
                spyable     : true,
                /** @scratch /panels/hiveplot/5
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
                $scope.hits = 0;    //This is just executed when the page is first started
                $scope.$on('refresh', function () {
                    //this part of the code is executed if the refresh symbol in the header is clicked
                    $scope.get_data();
                });
                $scope.get_data();  //This is executed when the page is started
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

                $scope.field = _.contains(fields.list, $scope.panel.field + '.raw') ? $scope.panel.field + '.raw' : $scope.panel.field;

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
                    )
                    .size(0);


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
                //This function filters the result. If you click on a node just the Connections to and from this node are shown
                var queryterm = "";
                $scope.data.forEach(function (d) {
                    if (d.label.indexOf(nodeName) > -1) {
                        if (queryterm === "") {
                            queryterm = queryterm + '' + $scope.field + ':\"' + d.label + '\"';
                        }
                        else {
                            queryterm = queryterm + ' OR ' + $scope.field + ':\"' + d.label + '\"';
                        }
                    }
                })
                filterSrv.set({
                    type: 'querystring', query: queryterm,
                    mandate: 'must'
                });
            };

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
        });

        module.directive('hiveplotChart', function (querySrv) {
            return {
                restrict: 'A',
                link: function (scope, elem) {

                    // Receive render events
                    scope.$on('render', function () {
                        render_panel(elem);
                    });

                    // Function for rendering panel
                    function render_panel(elem) {
                        var chartData =[];
                        build_results();
                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });
                        // Make a clone we can operate on and save it in 'chartData'.
                        scope.data.forEach(function (d) {
                            var obj = _.clone(d);
                            chartData.push(obj);
                        });
                        //chartData = _.clone(scope.data);
                        createHivePlot(scope, chartData, elem);
                    }

                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the hiveplot diagram are now saved in the array 'scope.data'
                        scope.data = [];
                        _.each(scope.results.facets.terms.terms, function (v) {
                            var slice;
                            slice = { label: v.term, data: v.count, color: querySrv.colors[k] };                            
                            scope.data.push(slice);
                            k = k + 1;
                        });
                    }
                }
            };

            function createHivePlot(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element
                //Build the network                        
                dataset = prepareDataset(dataset); //before invoking this function the dataset is the the data how it came from the datastore
                drawNetwork(dataset);
                
                function drawNetwork(dataset) {
                    var nodes = dataset.nodes,
                        links = dataset.links,
                        frame_width = window.screen.availWidth / 12 * scope.panel.span - 50,
                        frame_height = parseInt(scope.row.height.replace("px", "")),
                        number_of_plots = 1,    //This number has to be dynamically. Either by the settings in the editor or by the query
                        number_of_columns = Math.round(Math.sqrt(number_of_plots)),
                        number_of_rows = Math.ceil(number_of_plots / number_of_columns),
                        plot_width = frame_width / number_of_columns - 10,
                        plot_height = frame_height / number_of_rows - 10,
                        innerRadius = Math.min(plot_width, plot_height) * 0.02,
                        outerRadius = Math.min(plot_width, plot_height) * 0.4,
                        majorAngle = 2 * Math.PI / 3,   //120°
                        minorAngle = 1 * Math.PI / 12,  //15°
                        angle_domain = [],
                        angle_range =[];
                    if (scope.panel.number_of_axis === 2) {
                        angle_domain = [scope.panel.axis1, scope.panel.axis2];
                        angle_range = [0, majorAngle];
                    }
                    else {
                        angle_domain = [scope.panel.axis1, scope.panel.axis2, scope.panel.axis3];
                        angle_range = [0, majorAngle, 2*majorAngle];
                    }

                    var angle = d3.scale.ordinal()
                        .domain(angle_domain)
                        .range(angle_range);

                    var radius = d3.scale.linear()
                        .range([innerRadius, outerRadius]);

                    var formatNumber = d3.format(",d"),
                        defaultInfo;

                    //define tooltip
                    scope.tooltip = d3.select("body").append("div")
                        .attr("class", "tooltip")
                        .style("opacity", 0);

                    /*
                    *   In the following loop one or more divs and svgs within the divs is attached to the current div-element. 
                    *   The size of the svg is the same as the div. Depending on the number of plots the size gets smaller.
                    */
                    for (var count = 0; count < number_of_plots; count++) {
                        var svg = d3.select(elem[0]).append("div")  
                            .attr("width", plot_width)
                            .attr("height", plot_height)
                            .attr("id", elem[0].id + '-Panel' + count )
                            .attr("style", "outline: thin solid green;")
                            .append("svg")
                            .attr("width", plot_width)
                            .attr("height", plot_height)
                            .attr("style", "outline: thin solid blue;")
                            .append("g")
                            .attr("transform", "translate(" + plot_width / 2 + "," + plot_height/2 + ")");
                        
                        svg.selectAll(".axis")
                            .data(d3.range(3))
                            .enter().append("line")
                            .attr("class", "chord")
                            .attr("stroke-width", "1.5px")
                            .attr("transform", function (d) { return "rotate(" + degrees(angle(d)) + ")"; })
                            .attr("x1", radius.range()[0])
                            .attr("x2", radius.range()[1]);

                        svg.append("text")
                            .attr("id", scope.panel.axis1+"label")
                            .attr("x", 0)
                            .attr("y", 0)
                            .text(scope.panel.axis1)
                            .attr("text-anchor", "middle")
                            .attr("class", "linklabel")
                            .attr("dy", -(outerRadius+20))
                            .attr("dx", 0);

                        svg.append("text")
                            .attr("id", scope.panel.axis2+"label")
                            .attr("x", 0)
                            .attr("y", 0)
                            .text(scope.panel.axis2)
                            .attr("text-anchor", "right")
                            .attr("class", "linklabel")
                            .attr("dx", Math.sin(Math.PI - majorAngle) * outerRadius * 1.1)
                            .attr("dy", Math.cos(Math.PI - majorAngle) * outerRadius * 1.1);

                        if (scope.panel.number_of_axis === 3) {
                            svg.append("text")
                                .attr("id", scope.panel.axis3 + "label")
                                .attr("x", 0)
                                .attr("y", 0)
                                .text(scope.panel.axis3)
                                .attr("text-anchor", "middle")
                                .attr("class", "linklabel")
                                .attr("dx", -Math.sin(Math.PI - majorAngle) * outerRadius * 1.2)
                                .attr("dy", Math.cos(Math.PI - majorAngle) * outerRadius * 1.1);
                        }
                        
                        // Draw the links.
                        svg.append("g")
                            .selectAll(".link")
                            .data(links)
                            .enter().append("path")
                            .attr("d", link()
                                .angle(function (d) {
                                    return angle(d.axis);
                                })
                                .radius(function (d) {
                                    return radius(d.y);
                                }))
                            .attr("class", "link")
                            .attr("stroke-width", function (d) { return d.value })
                            .on("mouseover", function (d) {
                                linkMouseover(d, svg);
                            })
                            .on("mouseout", function (d) {
                                mouseout(d, svg);
                            });
                        
                        //Draw the nodes
                        svg.selectAll(".node")
                            .data(nodes)
                            .enter().append("circle")
                            .attr("class", "node")
                            .style("stroke", function (d) { if (scope.panel.colorcode === "black-white") { return "black"; } else { return d.color; } })
                            .attr("stroke-width", "1.5px")
                            .attr("transform", function (d) { return "rotate(" + degrees(angle(d.axis)) + ")"; })
                            .attr("cx", function (d) { return radius(d.y); })
                            .attr("r", 5)
                            .style("fill", function (d) { return d.color; })
                            .on("mouseover", function (d) {
                                nodeMouseover(d, svg);
                            })
                            .on("mouseout", function (d) {
                                mouseout(d, svg);
                            });
                    }
                }

                function linkMouseover(d, svg) {
                    var detailstext = '';
                    var data = dataset.links.filter(function (obj) {
                        return obj === d;
                    });
                    data.forEach(function (d) {
                        detailstext = detailstext + '' + (kbn.query_color_dot(d.source.color, 15) + kbn.query_color_dot(d.target.color, 15) + ' ' + d.relation + ' (' + d.value + ') <br/>');
                    });
                    show_tooltip(100, 0.9, detailstext, d3.event.pageX + 15, d3.event.pageY);

                    svg.selectAll(".link").classed("active", function (p) {
                        return p === d;
                    });
                }

                function nodeMouseover(d,svg) {
                    var detailstext = '<h5>' + d.label + '</h5>';
                    var data = dataset.links.filter(function (obj) {
                        if (d.axis === "source") {
                            return obj.source.label === d.label;
                        }
                        if (d.axis === "target") {
                            return obj.target.label === d.label;
                        }
                    });
                    data.forEach(function (d) {
                        detailstext = detailstext + '' + (kbn.query_color_dot(d.source.color, 15) + kbn.query_color_dot(d.target.color, 15) + ' ' + d.relation + ' (' + d.value + ') <br/>');
                    });
                    show_tooltip(100, 0.9, detailstext, d3.event.pageX + 15, d3.event.pageY);

                    svg.selectAll(".link").classed("active", function (p) {
                        return p.source === d || p.target === d;
                    });
                }

                function mouseout(d,svg) {
                    hide_tooltip(100, 0);
                    svg.selectAll(".link").classed("active", false);
                }

                function link() {
                    /*
                    *   Don't change anything in this function. This function draws the chords between the nodes.
                    */
                    var source = function (d) {
                        return d.source;
                    },
                        target = function (d) {
                            return d.target;
                        },
                        angle = function (d) {
                            return d.angle;
                        },
                        startRadius = function (d) {
                            return d.radius;
                        },
                        endRadius = startRadius,
                        arcOffset = -Math.PI / 2;

                    function link(d, i) {
                        var s = node(source, this, d, i),
                            t = node(target, this, d, i),
                            x;
                        if (t.a < s.a) x = t, t = s, s = x;
                        if (t.a - s.a > Math.PI) s.a += 2 * Math.PI;
                        var a1 = s.a + (t.a - s.a) / 3,
                            a2 = t.a - (t.a - s.a) / 3;

                        // draw cubic bezier curves for nodes on different axes
                        if (s.a != t.a) {
                            return s.r0 - s.r1 || t.r0 - t.r1 ? "M" + Math.cos(s.a) * s.r0 + "," + Math.sin(s.a) * s.r0 + "L" + Math.cos(s.a) * s.r1 + "," + Math.sin(s.a) * s.r1 + "C" + Math.cos(a1) * s.r1 + "," + Math.sin(a1) * s.r1 + " " + Math.cos(a2) * t.r1 + "," + Math.sin(a2) * t.r1 + " " + Math.cos(t.a) * t.r1 + "," + Math.sin(t.a) * t.r1 + "L" + Math.cos(t.a) * t.r0 + "," + Math.sin(t.a) * t.r0 + "C" + Math.cos(a2) * t.r0 + "," + Math.sin(a2) * t.r0 + " " + Math.cos(a1) * s.r0 + "," + Math.sin(a1) * s.r0 + " " + Math.cos(s.a) * s.r0 + "," + Math.sin(s.a) * s.r0 : "M" + Math.cos(s.a) * s.r0 + "," + Math.sin(s.a) * s.r0 + "C" + Math.cos(a1) * s.r1 + "," + Math.sin(a1) * s.r1 + " " + Math.cos(a2) * t.r1 + "," + Math.sin(a2) * t.r1 + " " + Math.cos(t.a) * t.r1 + "," + Math.sin(t.a) * t.r1;
                        }
                            // draw quadratic bezier curves for nodes on same axis
                        else {
                            a = s.a
                            var aCtrl = d.source.type === "pos" ? aCtrl = a + minorAngle * 2 : aCtrl = a - minorAngle * 2
                            m = Math.abs(s.r1 - t.r1)
                            rCtrl = s.r1 + m
                            return "M" + Math.cos(s.a) * s.r0 + "," + Math.sin(s.a) * s.r0 + "Q" + Math.cos(aCtrl) * rCtrl + "," + Math.sin(aCtrl) * rCtrl + " " + Math.cos(t.a) * t.r1 + "," + Math.sin(t.a) * t.r1;
                        }
                    }

                    function node(method, thiz, d, i) {
                        var node = method.call(thiz, d, i),
                            a = +(typeof angle === "function" ? angle.call(thiz, node, i) : angle) + arcOffset,
                            r0 = +(typeof startRadius === "function" ? startRadius.call(thiz, node, i) : startRadius),
                            r1 = (startRadius === endRadius ? r0 : +(typeof endRadius === "function" ? endRadius.call(thiz, node, i) : endRadius));
                        return {
                            r0: r0,
                            r1: r1,
                            a: a
                        };
                    }

                    link.source = function (_) {
                        if (!arguments.length) return source;
                        source = _;
                        return link;
                    };

                    link.target = function (_) {
                        if (!arguments.length) return target;
                        target = _;
                        return link;
                    };

                    link.angle = function (_) {
                        if (!arguments.length) return angle;
                        angle = _;
                        return link;
                    };

                    link.radius = function (_) {
                        if (!arguments.length) return startRadius;
                        startRadius = endRadius = _;
                        return link;
                    };

                    link.startRadius = function (_) {
                        if (!arguments.length) return startRadius;
                        startRadius = _;
                        return link;
                    };

                    link.endRadius = function (_) {
                        if (!arguments.length) return endRadius;
                        endRadius = _;
                        return link;
                    };

                    return link;
                };

                function prepareDataset(dataset) {
                    if (scope.panel.seperator === "") {
                        //if user enters space as seperator, the user interface ignores this value and leaves the variable blank.
                        //For that reason we catch this exception here and define the seperator as a space
                        scope.panel.seperator = " ";
                    }

                    var list_all_nodes = createNodeJSON(findUniqueNodes(dataset, "all"));
                    var links = createLinkJSON(dataset, list_all_nodes);

                    return { nodes: list_all_nodes, links: links };

                    function findUniqueNodes(dataset, type) {   //type can be source, target, all
                        var nodes = [];  //create array for the nodes. Its just an array of strings. No objects or anything similar.
                        dataset.forEach(function (d) {
                            //seperates all nodes and stores them in the array 'nodes'
                            seperateRelation(d.label).forEach(function (d) {
                                nodes.push(d);
                            });
                        });
                        var uniqueNodes = nodes.filter(onlyUnique); //all nodes in the array 'nodes' are filtered and only unique values remain
                        return uniqueNodes.sort();
                    }
                    function createNodeJSON(uniqueNodes) {  //creates a JSON file for all nodes with the attributes: name, radius_in, radius_out. When creating the file the values of radius_in, and radius_out are still empty. They are filled later.
                        var nodes = [], //create array with several objects of the nodes
                            k = 0;
                        uniqueNodes.forEach(function (d) {
                            if (scope.panel.colorcode === "black-white") {
                                var colorcode = "white";
                            }
                            else {
                                var colorcode = querySrv.colors2[k];
                            }
                            var object = {
                                "axis": "source",
                                "y": (k+1)/uniqueNodes.length,
                                "label": d,
                                "color": colorcode
                            };
                            k = k + 1;
                            nodes.push(object);
                        });
                        k = 0;
                        uniqueNodes.forEach(function (d) {
                            if (scope.panel.colorcode === "black-white") {
                                var colorcode = "white";
                            }
                            else {
                                var colorcode = querySrv.colors2[k];
                            }
                            var object = {
                                "axis": "target",
                                "y": (k + 1) / uniqueNodes.length,
                                "label": d,
                                "color": colorcode
                            };
                            k = k + 1;
                            nodes.push(object);
                        });
                        return nodes;   //returns an array of all nodes as objects with the attributes: axis, y, label and color
                    }
                    function createLinkJSON(dataset, nodes) {   //creates a JSON file for all links, with the attributes: source, target, and value
                        var directed_links = []; //creates array with several objects of the links
                        dataset.forEach(function (d) {
                            var object = {  //create an object for each link with the index of the node (NOT the name)
                                "relation": d.label,
                                "color": d.color,
                                "source": nodes.filter(function (obj) { return (obj.label === seperateRelation(d.label)[0] && obj.axis === "source") })[0],//nodes.map(function (e) { return e.name; }).indexOf(seperateRelation(d.label)[0]),
                                "target": nodes.filter(function (obj) { return (obj.label === seperateRelation(d.label)[1] && obj.axis === "target") })[0],//nodes.map(function (e) { return e.name; }).indexOf(seperateRelation(d.label)[1]),
                                "value": d.data
                            };
                            directed_links.push(object);
                        }); //format: relation, source, target, color, 
                        return directed_links;                        
                    }
                }
                
                function degrees(radians) {
                    return radians / Math.PI * 180 - 90;
                }

                function seperateRelation(text) {
                    var splittedRelation = text.split(scope.panel.seperator);
                    return splittedRelation;
                }

                function onlyUnique(value, index, self) {
                    return self.indexOf(value) === index;
                }

                function get_detailsOnChord(sourceID, targetID) {
                    var obj = scope.data.filter(function (obj) {
                        return obj.label === scope.uniqueNodes[sourceID].name + scope.panel.seperator + scope.uniqueNodes[targetID].name;
                    });
                    if (typeof obj[0] === 'undefined') {
                        return null;
                    }
                    else {
                        var source_color = scope.uniqueNodes[sourceID].color;
                        var target_color = scope.uniqueNodes[targetID].color;
                        var label = scope.uniqueNodes[sourceID].name + '' + scope.panel.seperator + '' + scope.uniqueNodes[targetID].name;

                        var data = obj[0].data;
                        var object = {
                            "source_color": source_color,
                            "target_color": target_color,
                            "label": label,
                            "data": data
                        };
                        return object;
                    }
                }

                function show_tooltip(duration, opacity, text, pos_left, pos_top) {
                    scope.tooltip.transition()
                        .duration(duration)
                        .style("opacity", opacity);
                    scope.tooltip.html(text);
                    scope.tooltip.style("left", pos_left + "px")
                        .style("top", pos_top + "px");
                }

                function hide_tooltip(duration, opacity) {
                    scope.tooltip.transition()
                        .duration(duration)
                        .style("opacity", opacity);
                }
            }

        });
    }
);
