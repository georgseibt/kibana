/** @scratch /panels/5
 *
 * include::panels/chord.asciidoc[]
 */

/** @scratch /panels/chord/0
 *
 * == chord
 * Status: *Stable*
 *
 * A chord diagram based on the results of an Elasticsearch terms facet.
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

        var module = angular.module('kibana.panels.chord', []);
        app.useModule(module);

        module.controller('chord', function ($scope, querySrv, dashboard, filterSrv, fields) {
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
                /** @scratch /panels/chord/5
                * === Parameters
                *
                * field:: The field on which to computer the facet
                */
                field   : '_type',
                /** @scratch /panels/chord/5
                * exclude:: terms to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/chord/5
                * size:: Show this many terms
                */
                size: 10,
                /** @scratch /panels/chord/5
                * === Parameters
                *
                * seperator:: The character which divides the column for the connections
                */
                seperator   : '-',
                /** @scratch /panels/chord/5
                * order:: How the terms are sorted: count, term, reverse_count or reverse_term,
                */
                order   : 'count',
                /** @scratch /panels/chord/5
                * arrangement:: Arrangement of the legend: horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/chord/5
                * counter_pos:: The location of the legend in respect to the diagram: above, below, or none.
                */
                counter_pos: 'above',
                /** @scratch /panels/network/5
                * tooltipsetting:: Indicates if tooltips should be shown if the user hovers over a segment or chord
                */
                tooltipsetting: 'true',
                /** @scratch /panels/network/5
                * direction:: Defines if the paths in the chorddiagram should be directed or undirected
                */
                direction: 'directed',
                /** @scratch /panels/chord/5
                * spyable:: Set spyable to false to disable the inspect button
                */
                spyable     : true,
                /** @scratch /panels/chord/5
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
                            queryterm = queryterm + "" + $scope.field + ":\"" + d.label + "\""
                        }
                        else {
                            queryterm = queryterm + " OR " + $scope.field + ":\"" + d.label + "\""
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

        module.directive('chordChart', function (querySrv) {
            return {
                restrict: 'A',
                link: function (scope, elem) {
                    var plot;

                    // Receive render events
                    scope.$on('render', function () {
                        render_panel(elem);
                    });

                    // Function for rendering panel
                    function render_panel(elem) {
                        var chartData;

                        build_results();

                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });

                        // Make a clone we can operate on.
                        chartData = _.clone(scope.data);

                        createChordDiagram(scope, chartData,elem);
                    }

                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the chord diagram are now saved in the array 'scope.data'
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

            function createChordDiagram(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element
                //Define Website Layout
                var width = window.screen.availWidth / 12 * scope.panel.span - 50,
                    height = parseInt(scope.row.height.replace("px", "")) - 10,
                    innerRadius = Math.min(width, height) * .4,
                    outerRadius = innerRadius + (Math.max(20, innerRadius* 0.12));

                console.log(innerRadius);
                console.log(outerRadius);
                console.log(outerRadius-innerRadius);

                //Define where the svg will be and how it will look like
                var svg = d3.select(elem[0]).append("svg")
                        .attr("width", width)
                        .attr("height", height)
                        .append("g")
                        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
                var dataset = prepareDataset(dataset);
                var uniqueNodes = dataset.nodes;
                var chordMatrix = dataset.matrix;
                scope.chordMatrix = chordMatrix;

                //Define the layout of the chords
                var chord = d3.layout.chord()
                        .matrix(chordMatrix)
                        .padding(0.05)
                        .sortSubgroups(d3.descending);
                var fill = d3.scale.category10();

                var g = svg.selectAll("g.group")
                        .data(chord.groups)
                        .enter().append("svg:g")
                        .attr("class", "group");

                var arc = d3.svg.arc()
                        .innerRadius(innerRadius)
                        .outerRadius(outerRadius);

                g.append("path")    //outer circle segment
                    .attr("d", arc)
                    .style("fill", function (d) { return uniqueNodes[d.index].color; })
                    .style("stroke", function (d) { return uniqueNodes[d.index].color; })
                    .attr("id", function (d, i) { return "group-" + elem[0].id + "" + d.index });;

                g.append("svg:text")    //name label of node in the outer circle segment
                        .attr("dx", function (d) {
                            if (d.endAngle - d.startAngle < 0.01)
                                return 0;
                            else
                                return 10
                        }) //larger number puts the label farer away from the border
                        .attr("dy", function (d) {
                            if (d.endAngle - d.startAngle < 0.01)
                                return 3;
                            else
                                return (outerRadius-innerRadius)-(outerRadius-innerRadius-12)/2;
                        })
                        .style("fill", "white")
                        .style("font", "12px Arial")
                        .append("svg:textPath")
                        .attr("xlink:href", function (d) { return "#group-" + elem[0].id + "" + d.index; })
                        .text(function (d) {
                            var segmentlength = 2 * outerRadius * Math.PI * ((d.endAngle - d.startAngle) / 2 / Math.PI);
                            if (d.endAngle - d.startAngle < 0.01 || segmentlength < uniqueNodes[d.index].name.length * 15) {
                                var countchar = (segmentlength - (segmentlength % 15)) / 15; //says how many characters can be shown theoretically (Assumption: a character needs 15px)
                                if (countchar <= 0)
                                    return (null);
                                else
                                    return (uniqueNodes[d.index].name.slice(0, Math.max(0,countchar-1)) + "...");
                            }
                            else
                                return uniqueNodes[d.index].name;
                        });

                var ticks = g.selectAll("g")
                        .data(groupTicks)
                        .enter().append("g")
                        .attr("transform", function (d) {
                            return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
                            + "translate(" + outerRadius + ",0)";
                        });

                ticks.append("line")    //small lines (scale) on the outside of the outer circle segment
                    //every fifth tick is shown. If more ticks should be shown, the value of d.show can be changed in the fundtion groupTicks()
                    .attr("x1", function (d) {
                        return d.show ? 1 : 0;
                    })
                    .attr("y1", 0)
                    .attr("x2", function (d) {
                        return d.show ? 5 : 0;
                    })
                    .attr("y2", 0)
                    .attr("class", "ticks");

                ticks.append("text")    //small text (scale) on the outside of the outer circle segment
                    .attr("x", 8)
                    .attr("dy", ".35em")
                    .attr("class", "ticks")
                    .style("font", "8px Arial")
                    .attr("transform", function (d) {
                        // Turn label if angle is > 180°
                        return d.angle > Math.PI ? "rotate(180)translate(-16)" : null;
                    })
                    .style("text-anchor", function (d) {
                        return d.angle > Math.PI ? "end" : null;
                    })
                    .text(function (d) { return d.label; });

                svg.append("g")     //chords (connections) between the circle segments
                    .attr("class", "chord")
                    .selectAll("path")
                    .data(chord.chords)
                    .enter().append("path")
                    .attr("d", d3.svg.chord().radius(innerRadius))
                    .style("fill", chordColor)
                    .attr("class", "chord")
                    .style("opacity", 1)
                    .on("mouseover", function (d) {
                        highlight_Chord(d);
                    })
                    .on("mouseout", function (d) {
                        hide_tooltip(100, 0);
                        fadeChord(1, d);
                    })
                    .on("mousemove", function (d) {
                        highlight_Chord(d);
                    });
                
                g.on("mouseover", fade(0.0))
                    .on("mouseout", fade(1.0))
                    .on("mousemove", fade(0.0))
                    .on("click", clickedNode());

                //define tooltip
                scope.tooltip = d3.select("body").append("div")
                    .attr("class", "tooltip")
                    .style("opacity", 0);
                
                function highlight_Chord(d) {
                    var detailstext = "";
                    var details = [];
                    details.push(get_detailsOnChord(d.source.index, d.target.index));
                    details.push(get_detailsOnChord(d.target.index, d.source.index));

                    //creation of detailstext for the directed graph
                    details.forEach(function (d) {
                        if (d != null)
                            detailstext = detailstext + (kbn.query_color_dot(d.source_color, 15) + kbn.query_color_dot(d.target_color, 15) + ' ' + d.label + " (" + d.data + ")<br/>");
                    })

                    if (scope.panel.direction != "directed") {
                        if (details[0] != null)
                            detailstext = detailstext + 'Sum: ' + details[0].sum;
                        else
                            detailstext = detailstext + 'Sum: ' + details[1].sum;
                    }
                    fadeChord(0, d);

                    if (scope.panel.tooltipsetting) {
                        show_tooltip(100, 0.9, detailstext, d3.event.pageX+15, d3.event.pageY);
                    }
                }

                function chordColor(d) {
                    return (d.source.value > d.target.value ? uniqueNodes[d.source.index].color : uniqueNodes[d.target.index].color);
                }

                function groupTicks(d) {
                    var k = (d.endAngle - d.startAngle) / d.value;
                    return d3.range(0, d.value, 1).map(function (v, i) {
                        return {
                            angle: v * k + d.startAngle,
                            show: i%5 != 0 ? false: true,
                            label: i % 10 != 0 ? null : v 
                        };
                    });
                }

                function fadeChord(opacity, chord) {
                    /*
                    *   This function hides chords in case of a mouseover event over a chord. If the mouse is over a chord, all other chords are hiden,
                    *   If the mouse goes out of the area, the chords are shown again
                    */
                    if (opacity < 1) {
                        svg.selectAll(".chord path")
                                .filter(function (d) {
                                    return !(d.source.index === chord.source.index && d.target.index === chord.target.index);
                                })
                                .transition()
                                .style("opacity", opacity);
                    }
                    else {
                        svg.selectAll(".chord path")
                                .filter(function (d) {
                                    return !(d.source.index === chord.source.index && d.target.index === chord.target.index);
                                })
                                .transition()
                                .style("opacity", opacity);
                    }
                }

                function fade(opacity) {
                    /*
                    *   This function hides chords in case of a mouseover event over a circle segment (node).
                    *   If the mouse is over the node, all chords which are not connected to the node are hidden.
                    *   If the mouse goes out of the area, the chords are shown again
                    *   In addition a tooltip is shown (show_tooltip)
                    */
                    if (opacity<1){
                        return function (g, i) {
                            var details = get_detailsOnNode(i);
                            //show tooltip when hovering over node
                            var detailstext = "<h4>"+ uniqueNodes[i].name + "</h4>"
                            details.forEach(function (d) {
                                detailstext = detailstext + (kbn.query_color_dot(d.source_color, 15) + kbn.query_color_dot(d.target_color, 15) + ' ' + d.label + " (" + d.data + ")<br/>");
                            })
                            show_tooltip(100, 0.9, detailstext, d3.event.pageX+15, d3.event.pageY);

                            //Hide unrelated chords
                            svg.selectAll(".chord path")
                                .filter(function (d) {
                                    return d.source.index != i && d.target.index != i;
                                })
                                .transition()
                                .style("opacity", opacity);
                        };
                    }
                    else {
                        return function (g, i) {
                            hide_tooltip(100, 0);
                            svg.selectAll(".chord path")
                                .filter(function (d) {
                                    return d.source.index != i && d.target.index != i;
                                })
                                .transition()
                                .style("opacity", opacity);
                        };
                    }
                }

                function clickedNode() {
                    return function (g, i) {
                        hide_tooltip(100, 0);
                        scope.build_search(uniqueNodes[i].name);
                    }
                }

                function prepareDataset(dataset) {
                    if (scope.panel.seperator === "") {
                        //if user enters space as seperator, the user interface ignores this value and leaves the variable blank.
                        //For that reason we catch this exception here and define the seperator as a space
                        scope.panel.seperator = " ";
                    }

                    scope.uniqueNodes = findUniqueNodes(dataset); //is a one dimensional array with all nodes
                    scope.chordMatrix = createChordMatrix(dataset, scope.uniqueNodes);    //is a two dimensional array with all values of the links between the nodes
                    scope.uniqueNodes = addColorToNodes(scope.uniqueNodes); //This function adds a colorcode to each node
                    return { nodes: scope.uniqueNodes, matrix: scope.chordMatrix };

                    
                }
                function createChordMatrix(dataset, nodes) {
                    var chordMatrix = [];
                    //fill Matrix with '0's and name columns and rows with the values from the array 'nodes'
                    for (var count = 0; count < nodes.length; count++) {
                        var row = [];
                        for (var count2 = 0; count2 < nodes.length; count2++) {
                            row[count2] = 0;
                        }
                        chordMatrix[count] = row;
                    }

                    dataset.forEach(function (d) {
                        //fill the 'chordMatrix' with the values from the JSON. If there are no values. The value will remain 0.
                        var rowname = nodes.indexOf(seperateRelation(d.label)[0]);
                        var columnname = nodes.indexOf(seperateRelation(d.label)[1]);

                        chordMatrix[rowname][columnname] = chordMatrix[rowname][columnname] + d.data;
                    });

                    if (scope.panel.direction === "directed") {
                        return chordMatrix;
                    }
                    else {
                        //if the graph should be undirected, the vallues are aggregated
                        var _chordMatrix = [];
                        for (var count = 0; count < nodes.length; count++) {
                            var row = [];
                            for (var count2 = 0; count2 < nodes.length; count2++) {
                                if (count != count2) {
                                    row[count2] = chordMatrix[count][count2] + chordMatrix[count2][count];
                                }
                                else {
                                    row[count2] = chordMatrix[count][count2];
                                }
                            }
                            _chordMatrix[count] = row;
                        }
                        return _chordMatrix;
                    }
                }

                function findUniqueNodes(dataset) {
                    var nodes = [];  //create array for the nodes

                    dataset.forEach(function (d) {
                        //seperates all nodes and stores them in the array 'nodes'
                        seperateRelation(d.label).forEach(function (d) {
                            nodes.push(d);
                        });
                    });
                    var uniqueNodes = nodes.filter(onlyUnique); //all nodes in the array 'nodes' are filtered and only unique values remain

                    return uniqueNodes;
                }

                function addColorToNodes(nodes) {
                    var uniqueNodes = [];
                    var k = 0;
                    nodes.forEach(function (d) {
                        var ob;
                        ob = { name: d, color: querySrv.colors2[k] };
                        uniqueNodes.push(ob);
                        k = k + 1;
                    });
                    return uniqueNodes;
                }

                function onlyUnique(value, index, self) {
                    return self.indexOf(value) === index;
                }

                function seperateRelation(text) {
                    var splittedRelation = text.split(scope.panel.seperator);
                    return splittedRelation;
                }

                function get_detailsOnNode(nodeID) {
                    var nodeName = scope.uniqueNodes[nodeID].name;
                    var links = [];

                    scope.data.forEach(function (d) {
                        if (d.label.indexOf(nodeName) > -1) {
                            var object = {
                                "source_color": scope.uniqueNodes.filter(function (obj) {
                                    return obj.name === seperateRelation(d.label)[0]; //=sourceName
                                })[0].color,
                                "target_color": scope.uniqueNodes.filter(function (obj) {
                                    return obj.name === seperateRelation(d.label)[1]; //=targetName
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
                        var label = scope.uniqueNodes[sourceID].name + "" + scope.panel.seperator + "" + scope.uniqueNodes[targetID].name;

                        var data = obj[0].data;
                        var sum = 0;
                        if (scope.panel.direction != "directed") {
                            sum = scope.chordMatrix[sourceID][targetID];
                        }
                        var object = {
                            "source_color": source_color,
                            "target_color": target_color,
                            "label": label,
                            "data": data,
                            "sum": sum
                        }
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
