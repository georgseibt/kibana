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
                field: '_type',
                /** @scratch /panels/chord/5
                * sourceField:: The source field on which to computer the facet
                */
                sourceField: '_type',
                /** @scratch /panels/chord/5
                * targetField:: The target field on which to computer the facet
                */
                targetField: '_type',
                /** @scratch /panels/chord/5
                * exclude:: terms to exclude from the results
                */
                exclude: [],
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
                * ticksLabel:: defines that each n th label of a tick is shown. For example a 1 indicates that every label is shown, a 4 that every 4th label is shown
                */
                ticksLabel: null,
                /** @scratch /panels/network/5
                * sortingTooltip:: defines by which criteria the connections in the tooltip should be sorted
                */
                sortingTooltip: 'source',
                /** @scratch /panels/network/5
                * sortingOrderTooltip:: defines if the nodes should be ordered ascending or descending
                */
                sortingOrderTooltip: true,
                /** @scratch /panels/network/5
                * tooltipSetting:: Indicates if tooltips should be shown if the user hovers over a segment or chord
                */
                tooltipSetting: true,
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

                //$scope.field = _.contains(fields.list, $scope.panel.field + '.raw') ?
                //    $scope.panel.field + '.raw' : $scope.panel.field;

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

                //if ($scope.panel.sourceField !== "" && $scope.panel.targetField !== "" && $scope.panel.field === "") {
                var request1 = $scope.ejs.Request().indices(dashboard.indices);
                request1 = request1
                    .facet(
                        $scope.ejs.TermsFacet('terms')
                        .field($scope.panel.sourceField)
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
                        );
                var results1 = request1.doSearch().then(function (results1) {
                    $scope.singleNodes = [];

                    _.each(results1.facets.terms.terms, function (v) {
                        $scope.singleNodes.push(v.term);
                    });

                    $scope.singleNodes.forEach(function (sourceNode) {
                        request = request
                        .facet(
                            $scope.ejs.TermsFacet(sourceNode)
                            .field($scope.panel.targetField)
                            .size($scope.panel.size)
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
                            );
                    });

                    //request = request
                    //    .facet(
                    //        $scope.ejs.TermsFacet('USA')
                    //        .field('Country_Connection')
                    //        .size($scope.panel.size)
                    //        .order($scope.panel.order)
                    //        .exclude($scope.panel.exclude)
                    //        .facetFilter(
                    //                $scope.ejs.AndFilter(
                    //                    [
                    //                        $scope.ejs.QueryFilter(
                    //                            $scope.ejs.FilteredQuery(
                    //                                boolQuery,
                    //                                filterSrv.getBoolFilter(filterSrv.ids())
                    //                            )
                    //                        ),
                    //                        $scope.ejs.QueryFilter(
                    //                            $scope.ejs.TermQuery(
                    //                                'Country_Target',
                    //                                'USA'
                    //                            )
                    //                        )
                    //                    ]
                    //                )
                    //            )
                    //        )
                    //    .facet(
                    //        $scope.ejs.TermsFacet('GB')
                    //        .field('Country_Connection')
                    //        .size($scope.panel.size)
                    //        .order($scope.panel.order)
                    //        .exclude($scope.panel.exclude)
                    //        .facetFilter(
                    //                $scope.ejs.AndFilter(
                    //                    [
                    //                        $scope.ejs.QueryFilter(
                    //                            $scope.ejs.FilteredQuery(
                    //                                boolQuery,
                    //                                filterSrv.getBoolFilter(filterSrv.ids())
                    //                            )
                    //                        ),
                    //                        $scope.ejs.QueryFilter(
                    //                            $scope.ejs.TermQuery(
                    //                                'Country_Target',
                    //                                'GB'
                    //                            )
                    //                        )
                    //                    ]
                    //                )
                    //            )
                    //        );

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
                //}
                //else {
                //    request = request
                //    .facet(
                //        $scope.ejs.TermsFacet('terms')
                //            .field($scope.panel.field)
                //            .size($scope.panel.size)
                //            .order($scope.panel.order)
                //            .exclude($scope.panel.exclude)
                //            .facetFilter(
                //                $scope.ejs.QueryFilter(
                //                    $scope.ejs.FilteredQuery(
                //                        boolQuery,
                //                        filterSrv.getBoolFilter(filterSrv.ids())
                //                    )
                //                )
                //            )
                //    )
                //    .size(0);


                //    // Populate the inspector panel; The current request will be shown in the inspector panel
                //    $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

                //    // Populate scope when we have results
                //    results = request.doSearch().then(function (results) {
                //        $scope.panelMeta.loading = false;
                //        $scope.hits = results.hits.total;
                //        $scope.results = results;
                //        $scope.$emit('render'); //dispatches the event upwards through the scope hierarchy of controllers.
                //    });
                //}
            };

            $scope.build_search = function (nodeName) {
                //This function filters the result. If you click on a node (border segment of the circle), just the Connections to and from this node are shown
                var queryterm = "";
                //$scope.data.forEach(function (d) {
                //    if (d.label.indexOf(nodeName) > -1) {
                //        if (queryterm === "") {
                //            queryterm = queryterm + '' + $scope.panel.field + ':\"' + d.label + '\"';
                //        }
                //        else {
                //            queryterm = queryterm + ' OR ' + $scope.panel.field + ':\"' + d.label + '\"';
                //        }
                //    }
                //});
                //$scope.data.forEach(function (d) {
                //    if (d.source === nodeName || d.target === nodeName) {
                if (queryterm === "") {
                    queryterm = queryterm + '' + $scope.panel.sourceField + ':\"' + nodeName + '\"' + ' OR ' + $scope.panel.targetField + ':\"' + nodeName + '\"';
                }
                else {
                    queryterm = queryterm + ' OR ' + $scope.panel.sourceField + ':\"' + nodeName + '\"' + ' OR ' + $scope.panel.targetField + ':\"' + nodeName + '\"';
                }
                //    }
                //});
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
                        
                        //if (scope.panel.sourceField !== "" && scope.panel.targetField !== "" && scope.panel.field === "") {
                        scope.singleNodes.forEach(function (sourceNode) {
                            //_.each(eval('scope.results.facets.' + sourceNode + '.terms'), function (v) {
                            _.each(scope.results.facets[sourceNode].terms, function (v) {
                                var slice;
                                slice = {
                                    source: sourceNode,
                                    target: v.term,
                                    data: v.count,
                                    color: querySrv.colors[k]
                                };

                                scope.data.push(slice);
                                k = k + 1;
                            });
                        });
                        //}
                        //else {
                        //    _.each(scope.results.facets.terms.terms, function (v) {
                        //        var slice;
                        //        slice = {
                        //            source: v.term.split(scope.panel.seperator)[0],
                        //            target: v.term.split(scope.panel.seperator)[1],
                        //            data: v.count,
                        //            color: querySrv.colors[k]
                        //        };
                        //        scope.data.push(slice);
                        //        k = k + 1;
                        //    });
                        //}
                    }
                }
            };

            function createChordDiagram(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element
                d3.select(elem[0]).append('div')
                    .attr("class", "chord-panel")
                    .attr("id", "chordpanel-" + elem[0].id);

                var data = prepareData(dataset);
                
                new Chorddiagram.Chart({
                    //Mandatory
                    "elem": "chordpanel-" + elem[0].id,     //id of the just created div
                    "data": data,
                    //Optional
                    "colors": null,
                    "numberOfTicks": scope.panel.numberOfTicks,
                    "ticksLabel": scope.panel.ticksLabel,
                    "segmentSize": scope.panel.segmentSize,                     //possible values: [outgoing, incoming]
                    "directed": scope.panel.directed,                           //possible values: [true, false] true means directed, false means undirected
                    "sorting": scope.panel.sortingNodes,                        //possible values: [label, color, outgoingTotal, incomingTotal, total, numberOfLinks]
                    "sortingOrder": scope.panel.sortingOrderNodes,              //possible values: [true, false] true means ascending, false means descending
                    "sortingTooltip": scope.panel.sortingTooltip,               //possible values: [source, target, data]
                    "sortingOrderTooltip": scope.panel.sortingOrderTooltip,     //possible values: [true, false] true means ascending, false means descending
                    "tooltipSetting": scope.panel.tooltipSetting,
                    "onClickNode": function (d) {
                        if (!d3.event.ctrlKey) { //node is only filtered if ctrl Key is NOT pressed
                            scope.build_search(d.label);
                        }
                    },
                    "onClickLink": null
                });

                function prepareData(dataset) {
                    var data = [];

                    dataset.forEach(function (link) {
                        var object = {
                            source: link.source,
                            target: link.target,
                            value: link.data
                        }
                        data.push(object);
                    });

                    return data;
                }
            }            
        });
    }
    );
