/** @scratch /panels/5
 *
 * include::panels/chord.asciidoc[]
 */

/** @scratch /panels/chord/0
 *
 * == chord
 * Status: *Stable*
 *
 * A table, bar chart or pie chart based on the results of an Elasticsearch chord facet.
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
                * exclude:: chord to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/chord/5
                * size:: Show this many chord
                */
                size: 10,
                /** @scratch /panels/chord/5
                * === Parameters
                *
                * seperator:: The character which divides the column for the connections
                */
                seperator   : '-',
                /** @scratch /panels/chord/5
                * order:: In chord mode: count, term, reverse_count or reverse_term,
                * in chord_stats mode: term, reverse_term, count, reverse_count,
                * total, reverse_total, min, reverse_min, max, reverse_max, mean or reverse_mean
                */
                order   : 'count',
                /** @scratch /panels/chord/5
                * arrangement:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/chord/5
                * counter_pos:: The location of the legend in respect to the chart, above, below, or none.
                */
                counter_pos: 'above',
                /** @scratch /panels/network/5
                * tooltips:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                tooltipsetting: 'true',
                /** @scratch /panels/network/5
                * direction:: defines if the paths in the network should be directed or undirected
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

            $scope.get_details = function (nodeName) {
                var links = [];
                $scope.data.forEach(function (d) {
                    if (d.label.indexOf(nodeName) > -1) {
                        links.push(d);
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
                $scope.tooltip.transition()
                                .duration(duration)
                                .style("opacity", opacity);
                $scope.tooltip.html(text);
                $scope.tooltip.style("left", pos_left + "px")
                    .style("top", pos_top + "px");
            }

            $scope.hide_tooltip = function (duration, opacity) {
                $scope.tooltip.transition()
                    .duration(duration)
                    .style("opacity", opacity);
            }
        });

        module.directive('chordChart', function (querySrv) {
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
                        //the result data (the data how we need them to draw the chord diagram are now saved in the array 'scope.data'
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

                        createChordDiagram(scope, chartData);
                    }
                }
            };

            function createChordDiagram(scope, dataset) {
                $('#chordGraphic').empty();  //removes all elements from the div with the id 'chordGraphic'

                //Define Website Layout
                var width = 560,
                    height = 500,
                    innerRadius = Math.min(width, height) * .41,
                    outerRadius = innerRadius * 1.12;

                //Define where the svg will be and how it will look like
                var svg = d3.select("#chordGraphic").append("svg")
                        .attr("width", width)
                        .attr("height", height)
                        //.attr("style", "outline: thin solid black")
                        .append("g")
                        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
                var dataset = prepareDataset(dataset);
                var uniqueNodes = dataset.nodes;
                var chordMatrix = dataset.matrix;

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
                    .attr("id", function (d, i) { return "group-" + d.index });;

                g.append("svg:text")    //name label of node in the outer circle segment
                        .attr("dx", 10) //larger number puts the label farer away from the border
                        .attr("dy", 15)
                        .style("fill", "white")
                        .append("svg:textPath")
                        .attr("xlink:href", function (d) { return "#group-" + d.index; })
                        .text(function (d) { return uniqueNodes[d.index].name; });

                var ticks = g.selectAll("g")
                        .data(groupTicks)
                        .enter().append("g")
                        .attr("transform", function (d) {
                            return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
                            + "translate(" + outerRadius + ",0)";
                        });

                ticks.append("line")    //small lines (scale) on the outside of the outer circle segment
                    .attr("x1", 1)
                    .attr("y1", 0)
                    .attr("x2", 5)
                    .attr("y2", 0)
                    .attr("class","ticks");

                ticks.append("text")    //small text (scale) on the outside of the outer circle segment
                    .attr("x", 8)
                    .attr("dy", ".35em")
                    .attr("class","ticks")
                    .attr("transform", function (d) {
                        // Beschriftung drehen wenn Kreiswinkel > 180�
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
                        //show tooltip
                        var detailstext = "";
                        var details = [];
                        if (typeof scope.get_details(uniqueNodes[d.source.index].name + "" + scope.panel.seperator + "" + uniqueNodes[d.target.index].name)[0] === 'undefined') { }
                        else {
                            details.push(scope.get_details(uniqueNodes[d.source.index].name + "" + scope.panel.seperator + "" + uniqueNodes[d.target.index].name)[0]);
                        }
                        if (typeof scope.get_details(uniqueNodes[d.target.index].name + "" + scope.panel.seperator + "" + uniqueNodes[d.source.index].name)[0] === 'undefined') { }
                        else {
                            details.push(scope.get_details(uniqueNodes[d.target.index].name + "" + scope.panel.seperator + "" + uniqueNodes[d.source.index].name)[0]);
                        }
                        details.forEach(function (d) {
                            detailstext = detailstext + (kbn.query_color_dot(d.color, 15) + ' ' + d.label + " (" + d.data + ")<br/>");
                        })
                        if (scope.panel.tooltipsetting) {
                            scope.show_tooltip(100, 0.9, detailstext, d3.event.pageX + 30, d3.event.pageY);
                        }
                    })
                    .on("mouseout", function (d) {
                        scope.hide_tooltip(100, 0);
                    });

                //define tooltip
                scope.tooltip = d3.select("body").append("div")
                    .attr("class", "tooltip")
                    .style("opacity", 0);
                
                function chordColor(d) {
                    return (d.source.value > d.target.value ? uniqueNodes[d.source.index].color : uniqueNodes[d.target.index].color);
                }

                function groupTicks(d) {
                    var k = (d.endAngle - d.startAngle) / d.value;
                    return d3.range(0, d.value, 1).map(function (v, i) {
                        return {
                            angle: v * k + d.startAngle,
                            label: i % 5 != 0 ? null : v 
                        };
                    });
                }

                function fade(opacity) {
                    if (opacity<1){
                        return function (g, i) {
                            //show tooltip
                            var details = scope.get_details(uniqueNodes[i].name);
                            var detailstext= ""
                            details.forEach(function (d) {
                                detailstext=detailstext+(kbn.query_color_dot(d.color, 15)+' '+d.label +" ("+d.data+")<br/>");
                            })
                            scope.show_tooltip(100, 0.9, detailstext, d3.event.pageX + 30, d3.event.pageY - 60);

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
                            scope.hide_tooltip(100, 0);
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
                        scope.hide_tooltip(100, 0);
                        scope.build_search(uniqueNodes[i].name);
                    }
                }

                g.on("mouseover", fade(0.0))
                    .on("mouseout", fade(1.0))
                    .on("click", clickedNode());

                function prepareDataset(dataset) {
                    if (scope.panel.seperator === "") {
                        //if user enters space as seperator, the user interface ignores this value and leaves the variable blank.
                        //For that reason we catch this exception here and define the seperator as a space
                        scope.panel.seperator = " ";
                    }

                    var uniqueNodes = findUniqueNodes(dataset); //is a one dimensional array with all nodes
                    var chordMatrix = createChordMatrix(dataset, uniqueNodes);    //is a two dimensional array with all values of the links between the nodes
                    uniqueNodes = addColorToNodes(uniqueNodes); //This function adds a colorcode to each node
                    return { nodes: uniqueNodes, matrix: chordMatrix };

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
                        var k=0;
                        nodes.forEach(function (d) {
                            var ob;
                            ob = { name: d, color: querySrv.colors2[k] };
                            uniqueNodes.push(ob);
                            k = k + 1;
                        });
                        return uniqueNodes;
                    }

                    function seperateRelation(text) {
                            var splittedRelation = text.split(scope.panel.seperator);
                        //if (scope.panel.seperator === "") {
                        //    //if user enters space as seperator, the user interface ignores this value and leaves the variable blank.
                        //    //For that reason we catch this exception here and define the seperator as a space
                        //    var splittedRelation = text.split(" ");
                        //}
                        //else {
                        //}
                        return splittedRelation;
                    }

                    function onlyUnique(value, index, self) {
                        return self.indexOf(value) === index;
                    }
                }
            }
        });
    }
    );
