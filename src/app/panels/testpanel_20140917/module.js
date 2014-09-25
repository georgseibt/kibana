/** @scratch /panels/5
 *
 * include::panels/terms.asciidoc[]
 */

/** @scratch /panels/terms/0
 *
 * == terms
 * Status: *Stable*
 *
 * A table, bar chart or pie chart based on the results of an Elasticsearch terms facet.
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

        var module = angular.module('kibana.panels.testpanel_20140917', []);
        app.useModule(module);

        module.controller('testpanel_20140917', function ($scope, querySrv, dashboard, filterSrv, fields) {
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
                /** @scratch /panels/terms/5
                * === Parameters
                *
                * field:: The field on which to computer the facet
                */
                field   : '_type',
                /** @scratch /panels/terms/5
                * exclude:: terms to exclude from the results
                */
                exclude : [],
                /** @scratch /panels/terms/5
                * size:: Show this many terms
                */
                size    : 10,
                /** @scratch /panels/terms/5
                * order:: In terms mode: count, term, reverse_count or reverse_term,
                * in terms_stats mode: term, reverse_term, count, reverse_count,
                * total, reverse_total, min, reverse_min, max, reverse_max, mean or reverse_mean
                */
                order   : 'count',
                /** @scratch /panels/terms/5
                * arrangement:: In bar or pie mode, arrangement of the legend. horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/terms/5
                * counter_pos:: The location of the legend in respect to the chart, above, below, or none.
                */
                counter_pos : 'above',
                /** @scratch /panels/terms/5
                * spyable:: Set spyable to false to disable the inspect button
                */
                spyable     : true,
                /** @scratch /panels/terms/5
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

            $scope.build_search = function (term, negate) {
                //not sure about this function. I think it is executed if you click on a node in the diagram and it creates a filter. Maybe we don't need this funtion for later
                if (_.isUndefined(term.meta)) {
                    filterSrv.set({
                        type: 'terms', field: $scope.field, value: term.label,
                        mandate: (negate ? 'mustNot' : 'must')
                    });
                }
                else if (term.meta === 'missing') {
                    filterSrv.set({
                        type: 'exists', field: $scope.field,
                        mandate: (negate ? 'must' : 'mustNot')
                    });
                }
                else {
                    return;
                }
            };

            $scope.set_refresh = function (state) {
                //This function is executed if some changes are done in the editor
                //console.log("Warum kann das nur sein");
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

            //$scope.showMeta = function (term) {
            //    if (_.isUndefined(term.meta)) {
            //        return true;
            //    }
            //    if (term.meta === 'other' && !$scope.panel.other) {
            //        return false;
            //    }
            //    if (term.meta === 'missing' && !$scope.panel.missing) {
            //        return false;
            //    }
            //    return true;
            //};
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
                        //console.log(scope.results.facets.terms.terms);
                        _.each(scope.results.facets.terms.terms, function (v) {
                            var slice;
                            slice = { label: v.term, data: v.count, color: querySrv.colors[k] };
                            
                            scope.data.push(slice);
                            k = k + 1;
                        });
                        /*We don't need the missing and other values for the chord diagram
                        
                        scope.data.push({
                            label: 'Missing field',
                            data: [[k, scope.results.facets.terms.missing]], meta: "missing", color: '#aaa', opacity: 0
                        });
                        if (scope.panel.tmode === 'terms') {
                            scope.data.push({
                                label: 'Other values',
                                data: [[k + 1, scope.results.facets.terms.other]], meta: "other", color: '#444'
                            });
                        }*/

                        console.log(scope.panel.size);
                        console.log(scope.data);
                    }

                    // Function for rendering panel
                    function render_panel() {
                        var chartData;

                        build_results();

                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });

                        // Make a clone we can operate on.
                        chartData = _.clone(scope.data);

                        createChordDiagram(chartData);

                        /*We don't have missing or other values, so we don't need to filter these data
                        chartData = scope.panel.missing ? chartData :
                            _.without(chartData, _.findWhere(chartData, { meta: 'missing' }));
                        chartData = scope.panel.other ? chartData :
                            _.without(chartData, _.findWhere(chartData, { meta: 'other' }));
                        //          console.log(chartData);
                        */

                        /*Old code to draw the pie or bar diagram
                        // Populate element.
                        require(['jquery.flot.pie'], function () {
                            // Populate element
                            try {
                                // Add plot to scope so we can build out own legend
                                if (scope.panel.chart === 'bar') {
                                    plot = $.plot(elem, chartData, {
                                        legend: { show: false },
                                        series: {
                                            lines: { show: false, },
                                            bars: { show: true, fill: 1, barWidth: 0.8, horizontal: false },
                                            shadowSize: 1
                                        },
                                        yaxis: { show: true, min: 0, color: "#c8c8c8" },
                                        xaxis: { show: false },
                                        grid: {
                                            borderWidth: 0,
                                            borderColor: '#c8c8c8',
                                            color: "#c8c8c8",
                                            hoverable: true,
                                            clickable: true
                                        },
                                        colors: querySrv.colors
                                    });
                                }
                                if (scope.panel.chart === 'pie') {
                                    var labelFormat = function (label, series) {
                                        return '<div ng-click="build_search(panel.field,\'' + label + '\')' +
                                            ' "style="font-size:8pt;text-align:center;padding:2px;color:white;">' +
                                            label + '<br/>' + Math.round(series.percent) + '%</div>';
                                    };

                                    plot = $.plot(elem, chartData, {
                                        legend: { show: false },
                                        series: {
                                            pie: {
                                                innerRadius: scope.panel.donut ? 0.4 : 0,
                                                tilt: scope.panel.tilt ? 0.45 : 1,
                                                radius: 1,
                                                show: true,
                                                combine: {
                                                    color: '#999',
                                                    label: 'The Rest'
                                                },
                                                stroke: {
                                                    width: 0
                                                },
                                                label: {
                                                    show: scope.panel.labels,
                                                    radius: 2 / 3,
                                                    formatter: labelFormat,
                                                    threshold: 0.1
                                                }
                                            }
                                        },
                                        //grid: { hoverable: true, clickable: true },
                                        grid: { hoverable: true, clickable: true, color: '#c8c8c8' },
                                        colors: querySrv.colors
                                    });
                                }

                                // Populate legend
                                if (elem.is(":visible")) {
                                    setTimeout(function () {
                                        scope.legend = plot.getData();
                                        if (!scope.$$phase) {
                                            scope.$apply();
                                        }
                                        //                  console.log(scope.legend);
                                    });
                                }

                            } catch (e) {
                                elem.text(e);
                            }
                        });
                        */
                    }

                    //elem.bind("plotclick", function (event, pos, object) {
                    //    if (object) {
                    //        scope.build_search(scope.data[object.seriesIndex]);
                    //    }
                    //});
                    //var $tooltip = $('<div>');
                    //elem.bind("plothover", function (event, pos, item) {
                    //    if (item) {
                    //        var value = scope.panel.chart === 'bar' ? item.datapoint[1] : item.datapoint[1][0][1];
                    //        $tooltip
                    //            .html(
                    //            kbn.query_color_dot(item.series.color, 20) + ' ' +
                    //            item.series.label + " (" + value.toFixed(0) + ")"
                    //            )
                    //            .place_tt(pos.pageX, pos.pageY);
                    //    } else {
                    //        $tooltip.remove();
                    //    }
                    //});

                }
            };

            function createChordDiagram(dataset) {
                $('#graphic').empty();  //removes all elements from the div with the id 'graphic'
                //console.log("JETZT gehtsg LO");
                //Define Website Layout
                var width = 560,
                    height = 500,
                    innerRadius = Math.min(width, height) * .41,
                    outerRadius = innerRadius * 1.1;

                //Define where the svg will be and how it will look like
                var svg = d3.select("#graphic").append("svg")
                        .attr("width", width)
                        .attr("height", height)
                        .attr("style", "outline: thin solid black")
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

                g.append("path")
                    .attr("d", arc)
                    .style("fill", function (d) { return uniqueNodes[d.index].color; })
                    .style("stroke", function (d) { return uniqueNodes[d.index].color; })
                    .attr("id", function (d, i) { return "group-" + d.index });;

                g.append("svg:text")
                        .attr("x", 6)
                        .attr("class", "country")
                        .attr("dy", 15)
                        .attr("fill", "white")
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

                ticks.append("line")
                    .attr("x1", 1)
                    .attr("y1", 0)
                    .attr("x2", 5)
                    .attr("y2", 0)
                    .style("stroke", "#000");

                ticks.append("text")
                    .attr("x", 8)
                    .attr("dy", ".35em")
                    .attr("fill", "white")
                    .attr("transform", function (d) {
                        // Beschriftung drehen wenn Kreiswinkel > 180�
                        return d.angle > Math.PI ? "rotate(180)translate(-16)" : null;
                    })
                    .style("text-anchor", function (d) {
                        return d.angle > Math.PI ? "end" : null;
                    })
                    .text(function (d) { return d.label; });

                svg.append("g")
                    .attr("class", "chord")
                    .selectAll("path")
                    .data(chord.chords)
                    .enter().append("path")
                    .attr("d", d3.svg.chord().radius(innerRadius))
                    .style("fill", chordColor)
                    .style("stroke", "white")
                    .style("opacity", 1);

                function chordColor(d) {
                    return (d.source.value > d.target.value ? uniqueNodes[d.source.index].color : uniqueNodes[d.target.index].color);
                }

                function groupTicks(d) {
                    var k = (d.endAngle - d.startAngle) / d.data;
                    return d3.range(0, d.data, 1).map(function (v, i) {
                        return {
                            angle: v * k + d.startAngle,
                            label: i % 5 != 0 ? null : v / 1 + "m"
                        };
                    });
                }

                function fade(opacity) {
                    return function (g, i) {
                        svg.selectAll(".chord path")
                        .filter(function (d) {
                            return d.source.index != i && d.target.index != i;
                        })
                        .transition()
                        .style("opacity", opacity);
                    };
                }

                g.on("mouseover", fade(0.0))
                    .on("mouseout", fade(1));

                function prepareDataset(dataset) {
                    var uniqueNodes = findUniqueNodes(dataset); //is a one dimensional array with all nodes
                    var chordMatrix = createChordMatrix(dataset, uniqueNodes);    //is a two dimensional array with all values of the links between the nodes
                    uniqueNodes = addColorToNodes(uniqueNodes); //This function adds a colorcode to each node

                    console.log(uniqueNodes);
                    console.log(chordMatrix);
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
                            var rowname = nodes.indexOf(seperateRelation(d.label, "-")[0]);
                            var columnname = nodes.indexOf(seperateRelation(d.label, "-")[1]);

                            chordMatrix[rowname][columnname] = chordMatrix[rowname][columnname] + d.data;
                        });
                        return chordMatrix;
                    }

                    function findUniqueNodes(dataset) {
                        var nodes = [];  //create array for the nodes

                        dataset.forEach(function (d) {
                            //seperates all nodes and stores them in the array 'nodes'
                            seperateRelation(d.label, "-").forEach(function (d) {
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
                        console.log(uniqueNodes);
                        return uniqueNodes;
                    }

                    function seperateRelation(text, seperator) {
                        var splittedRelation = text.split(seperator);
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
