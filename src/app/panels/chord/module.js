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
                        title: 'Queries',
                        src: 'app/partials/querySelect.html'
                    }
                ],
                status: "Stable",
                description: "Displays the results of an elasticsearch facet as a pie chart, bar chart, or a " +
                    "table"
            };

            // Set and populate defaults
            var _d = {
                /** @scratch /panels/chord/5
                * sourceField:: The source field on which to computer the facet
                */
                sourceField: '_type',
                /** @scratch /panels/chord/5
                * size1:: Show this many terms for field 1
                */
                size1: 10,
                /** @scratch /panels/chord/5
                * targetField:: The target field on which to computer the facet
                */
                targetField: '_type',
                /** @scratch /panels/chord/5
                * size2:: Show this many terms for field 2
                */
                size2: 10,
                /** @scratch /panels/chord/5
                * order:: How the terms are sorted: count, term, reverse_count or reverse_term, before they are filtered
                */
                order   : 'count',
                /** @scratch /panels/chord/5
                * exclude:: terms to exclude from the results
                */
                exclude: [],
                /** @scratch /panels/chord/5
                * counter_pos:: The location of the legend in respect to the diagram: above, below, or none.
                */
                counter_pos: 'above',
                /** @scratch /panels/chord/5
                * arrangement:: Arrangement of the legend: horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/network/5
                * sortingNodes:: Indicates how the nodes are sorted
                */
                sortingNodes: 'label',
                /** @scratch /panels/network/5
                * sortingOrderNodes:: Indicates if the nodes are sorted ascending (true) or descending (false)
                */
                sortingOrderNodes: true,
                /** @scratch /panels/network/5
                * segmentSize:: In the default case the attribute 'segmentSize' is set to the value 'outgoing'. That means that the width of a chord on the side of a node indicates how much leaves the node from there. For example if we have a connection from A to B with the value 4, the chord has a width of 4 where it is connected to node A, but a width of 0 at the other side.
                */
                segmentSize: 'outgoing',
                /** @scratch /panels/network/5
                * directed:: Defines if the paths in the chorddiagram should be directed (true) or undirected (false)
                */
                directed: true,
                /** @scratch /panels/network/5
                * numberOfTicks:: defines how many ticks should be displayed. For example a 1 indicates that every tick should be shown, a 4 that every 4th tick is shown
                */
                numberOfTicks: null,
                /** @scratch /panels/network/5
                * numberOfTicksLabel:: defines that each n th label of a tick is shown. For example a 1 indicates that every label is shown, a 4 that every 4th label is shown
                */
                numberOfTicksLabel: null,
                /** @scratch /panels/network/5
                * tooltipSetting:: Indicates if tooltips should be shown if the user hovers over a segment or chord
                */
                tooltipSetting: 'movable',
                /** @scratch /panels/network/5
                * sortingTooltip:: defines by which criteria the connections in the tooltip should be sorted
                */
                sortingTooltip: 'source',
                /** @scratch /panels/network/5
                * sortingOrderTooltip:: defines if the nodes should be ordered ascending or descending
                */
                sortingOrderTooltip: true,
                /** @scratch /panels/network/5
                * tooltipOrientation:: defines if the nodes should be ordered ascending or descending
                */
                tooltipOrientation: 'vertical',
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
                    //this part of the code is executed if the refresh symbol in the header is clicked or if 'save' or 'canceled' is clicked in the general configuration dashboard
                    $scope.get_data();
                });
                $scope.get_data();  //This is executed when the page is started
            };

            $scope.get_data = function () {
                $scope.generalTimeField = dashboard.current.nav[0].timefield;      //storing the timefield which is assigned inthe general settings. The timefield is needed if the field should be displayed in the diagram, so the values can be transformed to a date string
                // Make sure we have everything for the request to complete
                if (dashboard.indices.length === 0) {
                    return;
                }
                $scope.panelMeta.loading = true;
                var request,
                    results,
                    boolQuery,
                    queries,
                    request1,
                    results1;

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

                request1 = $scope.ejs.Request().indices(dashboard.indices);
                request1 = request1
                    .facet(
                        $scope.ejs.TermsFacet('terms')
                            .field($scope.panel.sourceField)
                            .size($scope.panel.size1)
                            .order($scope.panel.order)
                            .exclude($scope.panel.exclude)
                            .facetFilter(
                                $scope.ejs.AndFilter(
                                    [
                                        $scope.ejs.QueryFilter(
                                            $scope.ejs.FilteredQuery(
                                                boolQuery,
                                                filterSrv.getBoolFilter(filterSrv.ids())
                                            )
                                        )
                                    ]
                                )
                            )
                    )
                    .size(0);
                results1 = request1.doSearch().then(function (results1) {
                    var singleNodes = [];

                    _.each(results1.facets.terms.terms, function (v) {
                        singleNodes.push(v.term);
                    });

                    if (singleNodes.length === 0) {
                        /*if no terms are in 'singleNodes' we have to make sure that the request is not empty, so we create an alibi request here*/
                        request = request
                            .facet(
                                $scope.ejs.TermsFacet('terms')
                                    .field($scope.panel.targetField)
                                    .size($scope.panel.size2)
                                    .order($scope.panel.order)
                                    .exclude($scope.panel.exclude)
                                    .facetFilter(
                                        $scope.ejs.AndFilter(
                                            [
                                                $scope.ejs.QueryFilter(
                                                    $scope.ejs.FilteredQuery(
                                                        boolQuery,
                                                        filterSrv.getBoolFilter(filterSrv.ids())
                                                    )
                                                )
                                            ]
                                        )
                                    )
                            )
                            .size(0);
                    }
                    else {
                        /* creating the request*/
                        singleNodes.forEach(function (sourceNode) {
                            request = request
                                .facet(
                                    $scope.ejs.TermsFacet(sourceNode)
                                        .field($scope.panel.targetField)
                                        .size($scope.panel.size2)
                                        .order($scope.panel.order)
                                        .exclude($scope.panel.exclude)
                                        .facetFilter(
                                            $scope.ejs.AndFilter(
                                                [
                                                    $scope.ejs.QueryFilter(
                                                        $scope.ejs.FilteredQuery(
                                                            boolQuery,
                                                            filterSrv.getBoolFilter(filterSrv.ids())
                                                        )
                                                    ),
                                                    $scope.ejs.QueryFilter(
                                                        $scope.ejs.TermQuery(
                                                            $scope.panel.sourceField,
                                                            sourceNode
                                                        )
                                                    )
                                                ]
                                            )
                                        )
                                )
                                .size(0);
                        });
                    }

                    // Populate the inspector panel; The current request will be shown in the inspector panel
                    $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

                    // Populate scope when we have results
                    results = request.doSearch().then(function (results) {
                        $scope.panelMeta.loading = false;
                        $scope.hits = results.hits.total;

                        $scope.results = results;
                        $scope.$emit('render'); //dispatches the event upwards through the scope hierarchy of controllers.
                    });
                });
            };

            $scope.build_search = function (nodeName) {
                //This function filters the result. If you click on a node (border segment of the circle), just the Connections to and from this node are shown
                var queryterm = "";
                if (queryterm === "") {
                    queryterm = queryterm + '' + $scope.panel.sourceField + ':\"' + nodeName + '\"' + ' OR ' + $scope.panel.targetField + ':\"' + nodeName + '\"';
                }
                else {
                    queryterm = queryterm + ' OR ' + $scope.panel.sourceField + ':\"' + nodeName + '\"' + ' OR ' + $scope.panel.targetField + ':\"' + nodeName + '\"';
                }
                filterSrv.set({
                    type: 'querystring',
                    query: queryterm,
                    mandate: 'must'
                });
            };

            $scope.set_refresh = function (state) {
                //This function is executed if some changes are done in the editor
                $scope.refresh = state;
            };

            $scope.close_edit = function () {
                //This function is executed if the editor for the specific panel is closed by clicking 'Save'
                //The data are loaded again
                if ($scope.refresh) {
                    $scope.get_data();
                }
                $scope.refresh = false;
                $scope.$emit('render');
            };
            $scope.getDateAsString = function (date) {
                /*
                    Format of the passed variable:
                        date: is a date in date format

                    Task of the function:
                        This function transforms a date to the format YYYY-MM-dd hh:mm:ss

                    Format of the return value:
                        The function returns a time as a string in the format YYYY-MM-dd hh:mm:ss
                */
                var year, month, day, hour, minute, second;

                year = date.getFullYear();
                month = '0' + (date.getMonth() + 1);
                month = month.slice(-2, (month.length - 2) + 3);
                day = '0' + date.getDate();
                day = day.slice(-2, (day.length - 2) + 3);
                hour = '0' + date.getHours();
                hour = hour.slice(-2, (hour.length - 2) + 3);
                minute = '0' + date.getMinutes();
                minute = minute.slice(-2, (minute.length - 2) + 3);
                second = '0' + date.getSeconds();
                second = second.slice(-2, (second.length - 2) + 3);

                return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
            };
        });

        module.directive('chordChart', function (querySrv) {
            function createChordDiagram(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element

                /*Creating one div where the panel will be drawn*/
                d3.select(elem[0]).append('div')
                    .style("float", "left")
                    .style("width", function (d) { return scope.panel.tooltipSetting === "static" ? "80%" : "100%"; })
                    .style("height", function () { return 100 + "%"; })
                    .attr("id", "chordpanel-" + elem[0].id);

                d3.select(elem[0]).append('div')
                    .style("float", "left")
                    .style("width", function (d) { return scope.panel.tooltipSetting === "static" ? "20%" : "0%"; })
                    .style("height", function () { return 100 + "%"; })
                    .attr("id", "tooltip-" + elem[0].id);

                var data = prepareData(dataset);

                new Chorddiagram.Chart({
                    //Mandatory
                    "elem": "chordpanel-" + elem[0].id,     //id of the just created div
                    "data": data,
                    //Optional
                    "tooltipElem": "tooltip-" + elem[0].id,
                    "colors": null,
                    "numberOfTicks": scope.panel.numberOfTicks,
                    "numberOfTicksLabel": scope.panel.numberOfTicksLabel,
                    "segmentSize": scope.panel.segmentSize,                     //possible values: [outgoing, incoming]
                    "directed": scope.panel.directed,                           //possible values: [true, false] true means directed, false means undirected
                    "sorting": scope.panel.sortingNodes,                        //possible values: [label, color, outgoingTotal, incomingTotal, total, numberOfLinks]
                    "sortingOrder": scope.panel.sortingOrderNodes,              //possible values: [true, false] true means ascending, false means descending
                    "tooltipSetting": scope.panel.tooltipSetting,
                    "sortingTooltip": scope.panel.sortingTooltip,               //possible values: [source, target, data]
                    "sortingOrderTooltip": scope.panel.sortingOrderTooltip,     //possible values: [true, false] true means ascending, false means descending
                    "tooltipOrientation": scope.panel.tooltipOrientation,
                    "onClickNode": function (d) {
                        if (!d3.event.ctrlKey) { //node is only filtered if ctrl Key is NOT pressed
                            scope.build_search(d.label);
                        }
                    },
                    "onClickLink": null
                });

                function prepareData(dataset) {
                    var newData = [];

                    dataset.forEach(function (link) {
                        var object = {
                            source: link.source,
                            target: link.target,
                            value: link.data
                        };
                        newData.push(object);
                    });

                    return newData;
                }
            }

            return {
                restrict: 'A',
                link: function (scope, elem) {


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

                        createChordDiagram(scope, chartData, elem);
                    }

                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the chord diagram are now saved in the array 'scope.data'
                        scope.data = [];

                        Object.keys(scope.results.facets).forEach(function (sourceNode) {
                            _.each(scope.results.facets[sourceNode].terms, function (v) {
                                var slice;
                                slice = {
                                    source: (scope.panel.sourceField === scope.generalTimeField ? scope.getDateAsString(new Date(parseInt(sourceNode, 10))) : sourceNode),
                                    target: (scope.panel.targetField === scope.generalTimeField ? scope.getDateAsString(new Date(parseInt(v.term, 10))) : v.term),
                                    data: v.count,
                                    color: querySrv.colors[k]
                                };

                                scope.data.push(slice);
                                k = k + 1;
                            });
                        });
                    }
                }
            };
        });
    }
);