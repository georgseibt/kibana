(function () {
    var Hiveplot;
    Hiveplot = window.Hiveplot = {};    

    Hiveplot.Chart = function (_config) {
        /*
            Mandatory attributes
            ====================
            data            contains all connections which should be displayed in the hive plot. The structure of data is an array with several objects 
                            as the following:
                                {   axis1:          name of the first axis (if the links are directed, the axis where the links start)
                                    axis1NodeLabel: name of the node which lies on the first axis
                                    axis2:          name of the second axis (if the links are directed, the axis where the links end)
                                    axis2NodeLabel: name of the node which lies on the second axis
                                    value:          strength of the link
                                }
                            possible values: any in the above described format
            elem            is the id of a <div> in which the hive plot should be drawn
                            possible values: any valid id of a <div>

            Optional attributes
            ===================
            colorcode               defines if the nodes should be drawn in black-white or with colors
                                    default: 'black-white'
                                    possible values: ['black-white', 'colored']
            colors                  is an array of different colors. These colors are used for the filling of the nodes
                                    default: a number of colors in the attribute 'default_colorset'
                                    possible values: any array of colors
            colorscale              defines a set of colors which are used to highlight the links depending on their strength.
                                    A stronger link will be darker, a weaker link will be brighter.
                                    By default the scale has a length of ten colors. But a arbitrary set with any length can be passed.
            axisConfig              is an array of objects. Each object defines how the nodes on the axis should be sorted. Each object has the
                                    following structure:
                                    {   axis:   name of the axis
                                        sort:   defines according to which criteria the nodes should be sorted.
                                        order:  defines if the nodes should be ordered ascending or descending
                                    }
                                    default: if no axisConfig is passed, all nodes on each axis are sorted by value in ascending order
                                    possible values:    for axis: any axis which is also listed in data 
                                                        for sort: ['label', 'value', 'numberOfLinks']
                                                        for order: [true, false] true means ascending, false means descending
            nodes                   defines a list of all nodes. If a list with nodes is passed it has to have the following structure:
                                    {   axis:   name of the axis on which the node lies
                                        label:  name of the node
                                    }
                                    default: null
                                    possible values: any list of object with the above described structure
            sortingTooltip          defines by which criteria the connections in the tooltip should be sorted
                                    default: 'source'
                                    possible values: ['source', 'target', 'data']
            sortingOrderTooltip     defines if the nodes should be ordered ascending or descending
                                    default: true
                                    possible values [true, false] true means ascending, false means descending
            tooltipSetting          defines if tooltips should be shown in case of a mouseoverevent
                                    default: true
                                    possible values: [true, false]
            onClickNode             defines a function which should be executed on a click event on a node
                                    default: null
                                    possible values: any function
            onClickLink             defines a function which should be executed on a click event on a link
                                    default: null
                                    possible values: any function
        */


        /*
            Initializing default values
        */

        var default_colorscale = [
            "#FFD700", "#FFC200", "#FFAC00", "#FF9700", "#FF8100",
            "#FF5600", "#FF4100", "#FF2B00", "#FF1600", "#FF0000"
        ];
        var default_colorset = [
            "#8E388E", "#7171C6", "#7D9EC0", "#388E8E", "#71C671", "#8E8E38", "#C5C1AA", "#C67171",
            "#B0171F", "#9400D3", "#0000FF", "#CAE1FF", "#36648B", "#00F5FF", "#00C78C", "#FF8247",
            "#BDFCC9", "#32CD32", "#7CFC00", "#C0FF3E", "#FFFF00", "#FFF68F", "#CDAD00", "#FFB90F",
            "#FFE7BA", "#FFC1C1"
        ];
        var default_colorcode = 'black-white',
            default_sortingTooltip = 'source',
            default_sortingOrderTooltip = true,   //true means ascending, false means descending;
            default_tooltipSetting = true;

        /*
            Initializing the attributes
        */
        var DOMelem = (_config.elem),
            plotWidth = $("#" + DOMelem).width(),
            plotHeight = $("#" + DOMelem).height(),
            sortingTooltip = ((typeof _config.sortingTooltip === 'undefined' || _config.sortingTooltip === null) ? default_sortingTooltip : _config.sortingTooltip),
            sortingOrderTooltip = ((typeof _config.sortingOrderTooltip === 'undefined' || _config.sortingOrderTooltip === null) ? default_sortingOrderTooltip : _config.sortingOrderTooltip),
            tooltipSetting = ((typeof _config.tooltipSetting === 'undefined' || _config.tooltipSetting === null) ? default_tooltipSetting : _config.tooltipSetting),
            innerRadius = Math.min(plotWidth, plotHeight) * 0.02,
            outerRadius = Math.min(plotWidth, plotHeight) * 0.4,
            colorcode = ((typeof _config.colorcode === 'undefined' || _config.colorcode === null) ? default_colorcode : _config.colorcode),
            colors = ((typeof _config.colors === 'undefined' || _config.colors === null) ? default_colorset : _config.colors.concat(default_colorset)),
            colorscale = ((typeof _config.colorscale === 'undefined' || _config.colorscale === null) ? default_colorscale : _config.colorscale),
            data = prepareData(_config.data),
            nodes = data.nodes,
            links = data.links,
            angleDomain = [];

        if (typeof _config.axisConfig === 'undefined' || _config.axisConfig === null) {
            angleDomain = data.axis;
        }
        else {
            _config.axisConfig.forEach(function (axis) {
                angleDomain.push(axis.axis);
            })
        }
        var linkMin = data.linkMin,
            linkMax = data.linkMax,
            angleRange = [];

        for (var i = 0; i < angleDomain.length; i++) {
            if (angleDomain.length === 2) {
                angleRange[0] = 0;
                angleRange[1] = 2 * Math.PI / 3;
            }
            else {
                angleRange[i] = 2 * Math.PI / angleDomain.length * i;
            }
        }
               
        var angle = d3.scale.ordinal()
                        .domain(angleDomain)
                        .range(angleRange);

        var radius = d3.scale.linear()
            .range([innerRadius, outerRadius]);

        var formatNumber = d3.format(",d"),
            defaultInfo;

        var svg = d3.select('#'+DOMelem).append("div")
            .attr("width", plotWidth)
            .attr("height", plotHeight)
            .attr("id", DOMelem + '-Panel')
            .append("svg")
            .attr("width", plotWidth)
            .attr("height", plotHeight)
            .append("g")
            .attr("transform", "translate(" + plotWidth / 2 + "," + plotHeight / 2 + ")");

        svg.selectAll(".axis")
            .data(d3.range(angleDomain.length))
            .enter().append("line")
            .attr("class", "hiveplot-chord")
            .attr("stroke-width", "1.5px")
            .attr("transform", function (d) { return "rotate(" + degrees(angle(d)) + ")"; })
            .attr("x1", radius.range()[0])
            .attr("x2", radius.range()[1]);
        for (var i = 0; i < angleDomain.length; i++) {
            svg.append("text")
                .attr("id", angleDomain[i] + "label")
                .attr("x", 0)
                .attr("y", 0)
                .text(angleDomain[i])
                .attr("text-anchor", "right")
                .attr("class", "hiveplot-linklabel")
                .attr("dx", (Math.sin(angleRange[i]) * outerRadius * 1.1))
                .attr("dy", -(Math.cos(angleRange[i]) * outerRadius * 1.1))                
        }
        
        // Draw the links.
        svg.append("g")
            .selectAll(".hiveplot-link")
            .data(links)
            .enter().append("path")
            .attr("d", link()
                .angle(function (d) {
                    return angle(d.axis);
                })
                .radius(function (d) {
                    return radius(d.y);
                }))
            .attr("class", "hiveplot-link")
            .attr("fill", "none")
            .attr("stroke", function (d) {
                if (linkMin === linkMax) {
                    return colorscale[0];
                }
                else {
                    return colorscale[Math.ceil(d.value * (((colorscale.length - 1) - 0) / (linkMax - linkMin)) + ((0 * linkMax - (colorscale.length - 1) * linkMin) / (linkMax - linkMin)))];

                }                
            })
            .attr("stroke-width", function (d) { return d.value })
            .on("mouseover", function (d) {
                linkMouseover(d);
            })
            .on("mouseout", function (d) {
                mouseout(d, svg);
            })
            .on("click", function (d) {
                if (typeof _config.onClickLink === 'undefined' || _config.onClickNode === null) {
                    console.log("No function implemented")
                }
                else {
                    _config.onClickLink(d);
                }
            });

        //Draw the nodes
        svg.selectAll(".node")
            .data(nodes)
            .enter().append("circle")
            .attr("class", "hiveplot-node")
            .style("stroke", function (d) { if (colorcode === "black-white") { return "black"; } else { return d.color; } })
            .attr("stroke-width", "1.5px")
            .attr("transform", function (d) { return "rotate(" + degrees(angle(d.axis)) + ")"; })
            .attr("cx", function (d) { return radius(d.y); })
            .attr("r", 5)
            .style("fill", function (d) { if (colorcode === "black-white") { return ""; } else { return d.color; } })
            .on("mouseover", function (d) {
                nodeMouseover(d);
            })
            .on("mouseout", function (d) {
                mouseout(d, svg);
            })
            .on("click", function (d) {
                if (typeof _config.onClickNode === 'undefined' || _config.onClickNode === null) {
                    console.log("No function implemented");
                }
                else {
                    _config.onClickNode(d);
                }
            });

        function degrees(radians) {
            return radians / Math.PI * 180 - 90;
        }
        function link() {
            /*
            *   Don't change anything in this function. This function draws the links between the nodes.
            */
            var minorAngle = 1 * Math.PI / 12;
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
        }

        function prepareData(data) {
            /*
                The data has to have the following structure:
                {   axis1:              name of the first axis (if the links are directed, the axis where the links start)
                    axis1NodeLabel:   name of the node which lies on the first axis
                    axis2:              name of the second axis (if the links are directed, the axis where the links end)
                    axis2NodeLabel:   name of the node which lies on the second axis
                    value:              strength of the link
                }
            */
            var uniqueAxis = [],    //list of all axis without duplicates
                nodes = [],         //list of all nodes (duplicates included)
                hist = [],          //list with the total number of nodes per axis
                uniqueNodes = [],   //list of all nodes as objects without duplicates (objectstructutre: axis, y, label, color)
                links = [],         //list of all links. Source and target are references to the nodes (objectstructure: source, target, value)
                histCurrent = [],
                arrHelp = [],
                k = 0,
                values = [];
                linkMax = 0,
                linkMin = 0;    //assigning one random value from the data as the minimum


            /*
                Creates a list for all axis names and a list with all nodes and the axis on which they are. The list still contains duplicates.
                The list with the axis names is filtered for duplicates after the loop.
                Moreover the loop defines the maximum and minimum value of the links.
            */
            data.forEach(function (d) {
                values.push(d.value);
                uniqueAxis.push(d.axis1);
                uniqueAxis.push(d.axis2);
                nodes.push({ axis: d.axis1, y: 0, label: d.axis1NodeLabel, color: 'black', value: d.value, numberOfLinks: 1 });
                nodes.push({ axis: d.axis2, y: 0, label: d.axis2NodeLabel, color: 'black', value: d.value, numberOfLinks: 1 });
            });
            linkMin = Math.min.apply(Math, values);
            linkMax = Math.max.apply(Math, values);
            uniqueAxis = (uniqueAxis.filter(function onlyUnique(value, index, self) { return self.indexOf(value) === index; }));

            /*
                The list with the nodes and the axis on which they are is filtered for duplicates. At the same time the values for each node are aggregated.
                arrHelp[] is a supportive array to create the list of node objects
            */
            for (var i = 0; i < nodes.length; i++) {
                /*
                    if the node is not in the arrHelp yet it is added (if case). If not (else case) the values of the node are summed up and the numberOfLinks is increase by 1.
                */
                if (typeof arrHelp[nodes[i].axis + '-' + nodes[i].label] === 'undefined') {
                    arrHelp[nodes[i].axis + '-' + nodes[i].label] = nodes[i];
                }
                else {
                    arrHelp[nodes[i].axis + '-' + nodes[i].label].value = arrHelp[nodes[i].axis + '-' + nodes[i].label].value + nodes[i].value;
                    arrHelp[nodes[i].axis + '-' + nodes[i].label].numberOfLinks = arrHelp[nodes[i].axis + '-' + nodes[i].label].numberOfLinks + nodes[i].numberOfLinks;
                }
            };
            for (var item in arrHelp) {
                uniqueNodes[k++] = arrHelp[item];
            };
            /*
                Creating an object with several arrays. Each array includes the nodes for one axis.
                By that we can sort the nodes of each axis individually, which will happen in the next loop.
            */
            var uN = {};
            uniqueNodes.forEach(function (d) {
                if (uN[d.axis] === undefined) {
                    uN[d.axis] = [d];
                }
                else {
                    uN[d.axis].push(d);
                }
            });

            /*
                Counting how many nodes are on each axis and sorting the nodes by a certain criteria for each axis. 
                This criteria can be alphabetical, number of links from and to this node, etc.
                At the end each node is stacked back together into one array 'uniqueNodes'.
                Also the position of the node on the axis are defined. Nodes lie between 1/n th of the length of the axis and the end of the axis
                (n= number of nodes on the axis)
            */
            var count = 0;
            uniqueNodes.length = 0;
            uniqueAxis.forEach(function (axis) {
                hist[axis] = uN[axis].length;
                histCurrent[axis] = 1;
                try {
                    var axisConfig = _config.axisConfig.filter(function (object) { return object.axis === axis })[0];
                    uN[axis] = sortBy(uN[axis], axisConfig.sort, !axisConfig.order);
                }
                catch (err) {
                    uN[axis] = sortBy(uN[axis], 'value', false);

                }

                uN[axis].forEach(function (node) {
                    /*
                        Defining the position of the node and combining all nodes in one array ('uniqueNodes')
                    */
                    node.y = (histCurrent[node.axis] / hist[node.axis]);
                    histCurrent[node.axis]++;
                    node.color = colors[count++];
                    uniqueNodes.push(node);
                })
            });
            if (!(typeof _config.nodes === 'undefined' || _config.nodes === null)) {
                /*
                    If a list of nodes was passed, the nodes should remain sorted as given. Also potential additional nodes should be shown on the axis
                */
                uniqueAxis.forEach(function (axisName) {
                    hist[axisName] = 0;
                    histCurrent[axisName] = 1
                })

                var count = 0;
                _config.nodes.forEach(function (node) {
                    //hist[node.axis]++;  //counts how many nodes are on the axis
                    var nodeOld = uniqueNodes.filter(function (object) { return object.axis === node.axis && object.label === node.label })[0];
                    try {
                        node.value = nodeOld.value;
                        node.numberOfLinks = nodeOld.numberOfLinks;
                    }
                    catch (err) {
                        node.value = 0;
                        node.numberOfLinks = 0;
                    }
                    node.color = colors[count++];
                });

                var nodesByAxis = {};
                _config.nodes.forEach(function (node) {
                    if (nodesByAxis[node.axis] === undefined) {
                        nodesByAxis[node.axis] = [node];
                    }
                    else {
                        nodesByAxis[node.axis].push(node);
                    }
                });
                var listOfNodes = [];
                uniqueAxis.forEach(function (axis) {
                    hist[axis] = nodesByAxis[axis].length; //counts how many nodes are on the axis
                    try {
                        var axisConfig = _config.axisConfig.filter(function (object) { return object.axis === axis })[0];
                        nodesByAxis[axis] = sortBy(nodesByAxis[axis], axisConfig.sort, !axisConfig.order);
                    }
                    catch (err) {
                        nodesByAxis[axis] = sortBy(nodesByAxis[axis], 'label', false);

                    }

                    nodesByAxis[axis].forEach(function (node) {
                        node.y = (histCurrent[node.axis] / hist[node.axis]);
                        histCurrent[node.axis]++;
                        listOfNodes.push(node);
                    });
                });

                uniqueNodes = listOfNodes;
            }

            /*
                Assignment of the links to a new array. In this array the links are saved as objects, where the source and targets are references to the nodes. 
            */
            data.forEach(function (d) {
                var obj = {
                    source: uniqueNodes.filter(function (object) { return object.axis === d.axis1 && object.label === d.axis1NodeLabel })[0],
                    target: uniqueNodes.filter(function (object) { return object.axis === d.axis2 && object.label === d.axis2NodeLabel })[0],
                    value: d.value
                }
                links.push(obj);
            });
            return { axis: uniqueAxis, nodes: uniqueNodes, links: links, linkMin: linkMin, linkMax: linkMax };
        }

        function linkMouseover(d) {
            /*
                This function creates a tooltip if the mouse hovers over a link. The tooltip includes the information about the links (connections).
                The tooltip says the source node, the target node and the value of the connection. 
                The link is also highlighted.
            */
            if (tooltipSetting) {
                var detailstext = '';
                var data = links.filter(function (obj) {
                    return obj === d;
                });
                data.forEach(function (d) {
                    detailstext = detailstext + '' + (queryColorDot(d.source.color, 15) + ' ' + queryColorDot(d.target.color, 15) + ' ' + d.source.label + '-' + d.target.label + ' (' + d.value + ') <br/>');
                });
                showTooltip(100, 0.9, detailstext, d3.event.pageX + 15, d3.event.pageY);
            }
            svg.selectAll(".hiveplot-link").classed("hiveplot-active", function (p) {
                return p === d;
            });
            svg.selectAll(".hiveplot-link").classed("hiveplot-inactive", function (p) {
                return p !== d;
            });
        }
        function nodeMouseover(d) {
            /*
                This function creates a tooltip if the mouse hovers over a node. The tooltip includes the Name of the node, the sum of all values of its links,
                and the information about the links (connections).
                The tooltip says the source node, the target node and the value of each connection.
                The links to and from this node are also highlighted.
            */
            if (tooltipSetting) {
                var detailstext = '<h4 class=hiveplot-h4>' + d.label + ' (' + d.value + ')</h4>';
                var data = links.filter(function (obj) {
                    return (obj.source === d || obj.target === d)
                });

                var details = [];
                data.forEach(function (link) {
                    var object = {
                        "sourceColor": link.source.color,
                        "source": link.source.label,
                        "targetColor": link.target.color,
                        "target": link.target.label,
                        "data": link.value
                    }
                    details.push(object);
                });
                details = sortBy(details, sortingTooltip, !sortingOrderTooltip);

                details.forEach(function (d) {
                    detailstext = detailstext + '' + (queryColorDot(d.sourceColor, 15) + ' ' + queryColorDot(d.targetColor, 15) + ' ' + d.source + '-' + d.target + ' (' + d.data + ') <br/>');
                });
                showTooltip(100, 0.9, detailstext, d3.event.pageX + 15, d3.event.pageY);
            }

            svg.selectAll(".hiveplot-link").classed("hiveplot-active", function (p) {
                return p.source === d || p.target === d;
            });
            svg.selectAll(".hiveplot-link").classed("hiveplot-inactive", function (p) {
                return p.source !== d && p.target !== d;
            });
        }
        function mouseout(d, svg) {
            try {
                document.getElementById("tooltip").remove();
            }
            catch (err) { };
            svg.selectAll(".hiveplot-link").classed("hiveplot-active", false);
            svg.selectAll(".hiveplot-link").classed("hiveplot-inactive", false);
        }

        function showTooltip(duration, opacity, text, posLeft, posTop) {
            var tooltip = d3.select("body").append("div")
                .attr("id", "tooltip")
                .attr("class", "hiveplot-tooltip");
            tooltip.transition()
                .duration(duration)
                .style("opacity", opacity);
            tooltip.html(text)
                .style("left", posLeft + "px")
                .style("top", posTop + "px");
        }
        function queryColorDot(color, diameter) {
            return '<div style="' + [
                'display:inline-block',
                'color:' + color,
                'font-size:' + diameter + 'px',
                'border-radius: 50%',
                'width:' + diameter + 'px',
                'height:' + diameter + 'px',
                'background:' + color,
            ].join(';') + '"></div>';
        }
        function sortBy(array, property, reverse) {
            if (property === null || property === '') {
                return array;
            }
            else {
                array.sort(dynamicSort(property, reverse))
                return array;
            }
        }
        function dynamicSort(property, reverse) {
            /*
                This function can sort an array with objects by one of its properties. It can also reverse the sorting
            */
            var sortOrder = 1;
            if (property[0] === '-') {
                sortOrder = -1;
                property = property.substr(1);
            }
            if (!reverse) {
                return function (a, b) {
                    var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
                    return result * sortOrder;
                }
            }
            else {
                return function (a, b) {
                    var result = (a[property] > b[property]) ? -1 : (a[property] < b[property]) ? 1 : 0;
                    return result * sortOrder;
                }
            }
        }
    }
}).call(this);