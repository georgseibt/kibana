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
            plotElem        is the id of a <div> in which the hive plot should be drawn
                            possible values: any valid id of a <div>

            Optional attributes
            ===================
            tooltipElem             is the id of a <div> where the tooltip should appear. If the tooltip should be movable or no
                                    tooltip should be shown, the element can remain empty
                                    possible values: any valid id of a <div> or Null
            colorcode               defines if the nodes should be drawn in black-white or with colors
                                    default: 'black-white'
                                    possible values: ['black-white', 'colored']
            nodesColorSchema        is a color which is used to generate a colorgradient based on this color
                                    default: 'blue'
                                    possible values: any valid color
            linksColorSchema        is an array of information about the colors which should be used to draw the links.
                                    The intensity of the links should change depending on the strength of the link.
                                    The array has the format [startColor, endColor, numberOfNuances]
                                    default: ['#FF0000', '#FFD700', 10]
                                    possible values: any valid color and any valid number
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
                                    possible values: ['label', 'data']
            sortingOrderTooltip     defines if the nodes should be ordered ascending or descending
                                    default: true
                                    possible values [true, false] true means ascending, false means descending
            tooltipSetting          defines if tooltips should be shown in case of a mouseoverevent
                                    default: static
                                    possible values: ['none', 'movable', 'static']
            tooltipOrientation      defines if the text in the tooltip should be horizontal or vertical
                                    default: horizontal
                                    possible values: ['horizontal', 'vertical']
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

        

        var default_colorscale = generateColorGradient("#FFD700", "#FF0000", 10),
            default_colorcode = 'black-white',
            default_nodesColorSchema = 'blue',
            default_sortingTooltip = 'source',
            default_sortingOrderTooltip = true,   //true means ascending, false means descending;
            default_tooltipSetting = "static",
            default_tooltipOrientation = "horizontal";

        /*
            Initializing the attributes
        */
        var plotElem = (_config.plotElem),
            tooltipElem = ((typeof _config.tooltipElem === 'undefined' || _config.tooltipElem === null) ? null : _config.tooltipElem),
            plotWidth = $("#" + plotElem).width(),
            plotHeight = $("#" + plotElem).height(),
            sortingTooltip = ((typeof _config.sortingTooltip === 'undefined' || _config.sortingTooltip === null) ? default_sortingTooltip : _config.sortingTooltip),
            sortingOrderTooltip = ((typeof _config.sortingOrderTooltip === 'undefined' || _config.sortingOrderTooltip === null) ? default_sortingOrderTooltip : _config.sortingOrderTooltip),
            tooltipSetting = ((typeof _config.tooltipSetting === 'undefined' || _config.tooltipSetting === null) ? default_tooltipSetting : _config.tooltipSetting),
            tooltipOrientation = ((typeof _config.tooltipOrientation === 'undefined' || _config.tooltipOrientation === null) ? default_tooltipOrientation : _config.tooltipOrientation),
            innerRadius = Math.min(plotWidth, plotHeight) * 0.02,
            outerRadius = Math.min(plotWidth, plotHeight) * 0.4,
            colorcode = ((typeof _config.colorcode === 'undefined' || _config.colorcode === null) ? default_colorcode : _config.colorcode),
            nodesColorSchema = ((typeof _config.nodesColorSchema === 'undefined' || _config.nodesColorSchema === null) ? default_nodesColorSchema : _config.nodesColorSchema),
            colors = [],
            linksColors = ((typeof _config.colorscale === 'undefined' || _config.colorscale === null) ? default_colorscale : generateColorGradient(_config.colorscale[0], _config.colorscale[1], _config.colorscale[2])),
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
        var linkMin = ((typeof _config.linkMin === 'undefined' || _config.linkMin === null) ? data.linkMin : _config.linkMin),
            linkMax = ((typeof _config.linkMax === 'undefined' || _config.linkMax=== null) ? data.linkMax : _config.linkMax),
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

        var svg = d3.select('#'+plotElem).append("div")
            .attr("width", plotWidth)
            .attr("height", plotHeight)
            .attr("id", plotElem + '-Panel')
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
                .text((i===0? "x" : ( i===1 ? "y" : "z")))//angleDomain[i])
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
                    return linksColors[0];
                }
                else {
                    return linksColors[Math.round(d.value * (((linksColors.length - 1) - 0) / (linkMax - linkMin)) + ((0 * linkMax - (linksColors.length - 1) * linkMin) / (linkMax - linkMin)))];
                }                
            })
            //.attr("stroke-width", function (d) { return d.value })
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
            .style("stroke", function (d) { if (colorcode === "black-white") { return "white"; } else { return d.color; } })
            .attr("stroke-width", "1.5px")
            .attr("transform", function (d) { return "rotate(" + degrees(angle(d.axis)) + ")"; })
            .attr("cx", function (d) { return radius(d.y); })
            .attr("r", 5)
            .style("fill", function (d) { if (colorcode === "black-white") { return "black"; } else { return d.color; } })
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
                Format of the passed variable:
                    'data' is an array of multiple objects. Each object represents a link between two nodes. Each node lies on a axis.
                    So, each object is required to have the following structure when it is passed to this function:
                    {   axis1:              name of the first axis
                        axis1NodeLabel:     name of the node which lies on the first axis
                        axis2:              name of the second axis
                        axis2NodeLabel:     name of the node which lies on the second axis
                        value:              strength of the link
                    }

                Task of the function:
                    The function has several tasks to do:
                    1. Identifying unique axis
                    2. Identifying unique nodes
                    3. Identifying the maximum and minimum value of the links
                    3. Changing the format of the links before it is returned

                Format of the return value:
                    The function returns an object with a list of the unique axes, the unique nodes, the links, the minimum value of the links, and the maximum value of the links.
            */
            var uniqueAxis = [],    //is an array with the names of the axes. In the first step the array will include all axes found in the passed varaible 'data'. Later the array will be filtered and it will only contain unique names and no duplicates anymore.
                nodes = [],         //is an array with multiple objects. Each object represents a node. The object contains the following information {axis: says on which axis the node lies, y: says where on the axis the node lies, label: is the name of the node, color: says the color of the node, value: is the sum of the values of all links of the node, numberOfLinks: says to how many nodes the node is linked}. The array still contains duplicates.
                hist = [],          //is an array with the total number of nodes per axis
                uniqueNodes = [],   //is an array of all nodes as objects without duplicates (the object structure is still the same as above: {axis, y, label, color, value, numberOfLinks})
                links = [],         //is an array of all links as objects. The object has the following structure {source, target, value} The source and the target are references to the objects in the uniqueNodes array.
                histCurrent = [],
                arrHelp = [],
                k = 0,
                values = [],        //is an array where all values of the links will be stored. The array will be used later to calculate the maximum and minimum of these values.
                linkMax,            //is the maximum of the values of the links. It is calculated from the array 'values'
                linkMin;            //is the minimum of the values of the links. It is calculated from the array 'values'


            /*
                Creates a list for all axis names and a list with all nodes and the axis on which they are. The list still contains duplicates.
                The list with the axis names is filtered for duplicates after the loop.
                Moreover the loop defines the maximum and minimum value of the links.
            */
            data.forEach(function (d) {
                /*This loop goes through all links stored in the variable 'data' and stores the infromation in the arrays*/
                values.push(d.value);           //all values of the links are pushed in the variable 'values'. That array is used later to get the maximum and minimum of the values.
                uniqueAxis.push(d.axis1);       //the name of the axis where the first node of the link lies is pushed in the array 'uniqueAxis'
                uniqueAxis.push(d.axis2);       //the name of the axis where the second node of the link lies is pushed in the array 'uniqueAxis'
                nodes.push({ axis: d.axis1, y: 0, label: d.axis1NodeLabel, color: 'black', value: d.value, numberOfLinks: 1 }); //The first node of the link is pushed in the array 'nodes' with the given structure. Some variables of the object get default values like y, color, and numberOfLinks. The real values are calculated or assigned later
                nodes.push({ axis: d.axis2, y: 0, label: d.axis2NodeLabel, color: 'black', value: d.value, numberOfLinks: 1 }); //The second node of the link is pushed in the array 'nodes' with the given structure. Some variables of the object get default values like y, color, and numberOfLinks. The real values are calculated or assigned later
            });
            linkMin = Math.min.apply(Math, values); //The Minimum of the values is calculated and stored in the variable
            linkMax = Math.max.apply(Math, values); //The Maximum of the values is calculated and stored in the variable
            uniqueAxis = (uniqueAxis.filter(function onlyUnique(value, index, self) { return self.indexOf(value) === index; }));    //All the duplicates of the axis are removed from 'uniqueAxis'. uniqueAxis remains an array with only distinct axis names.

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
                    arrHelp[nodes[i].axis + '-' + nodes[i].label].value = arrHelp[nodes[i].axis + '-' + nodes[i].label].value + nodes[i].value;     //Summing up the values
                    arrHelp[nodes[i].axis + '-' + nodes[i].label].numberOfLinks = arrHelp[nodes[i].axis + '-' + nodes[i].label].numberOfLinks + nodes[i].numberOfLinks; //increasing the numberOfLinks by 1
                }
            };
            for (var item in arrHelp) {
                uniqueNodes[k++] = arrHelp[item];   //arrHelp is an array with a list of distinct nodes now. The nodes are stored in the new variable 'uniqueNodes' now. uniqueNodes contains a list of all nodes with the correct values for axis, label, value, and numberOfLinks. y and color still has default values.
            };
            /*
                Creating an object with several arrays. Each array includes the nodes for one axis.
                By that we can sort the nodes of each axis individually, which will happen in the next loop.
            */
            var nodesPerAxis = {};
            uniqueNodes.forEach(function (d) {
                /*
                    if an object for the axis already exists the node is pushed to the according array (else case). If the object doesn't exist yet the node is assigned as a first value in the array (if case)
                */
                if (nodesPerAxis[d.axis] === undefined) {
                    nodesPerAxis[d.axis] = [d]; //Assigning the first node to the array
                }
                else {
                    nodesPerAxis[d.axis].push(d);   //pushing an additional node to the array
                }
            });

            /*
                In the following the nodes on each axis are sorted by a criteria. The criteria can be different for each axis.
                How the axis should be sorted is given in the object axisConfig under the variable 'sort'. The axis can be sorted in ascending or descending order (variable 'order')
                If no specifications are given, the nodes are always sorted by the variable 'label' in ascending order
                After the nodes are ordered the 'y' value and the 'color' is assigned to the nodes. Therefore the numbe rof nodes on each axis is counted and the nodes are equally spread.
            */
            var count = 0;
            var numberOfNodes = uniqueNodes.length; //counting the total number of nodes, because we generate as many colors as we need in the next line
            colors = randomColor({ count: numberOfNodes, hue: nodesColorSchema });  //getting an array with several different colors but with the same hue.

            uniqueNodes.length = 0; //the array uniqueNodes is emptied (setting the length to 0) so the nodes can be assigned to the array again after they were sorted before.
            uniqueAxis.forEach(function (axis) {
                /*
                    Here we iterate through the arrays with the nodes per axis. Each axis is ordered by its criteria
                */
                try {
                    var axisConfig = _config.axisConfig.filter(function (object) { return object.axis === axis })[0];
                    nodesPerAxis[axis] = sortBy(nodesPerAxis[axis], axisConfig.sort, !axisConfig.order);
                }
                catch (err) {
                    nodesPerAxis[axis] = sortBy(nodesPerAxis[axis], 'label', false);

                }
                hist[axis] = nodesPerAxis[axis].length;
                histCurrent[axis] = 1;

                nodesPerAxis[axis].forEach(function (node) {
                    /*
                        Defining the position of the node, assigning a color and combining all nodes in one array ('uniqueNodes')
                    */
                    node.y = (histCurrent[node.axis] / hist[node.axis]);    //assigning the y value
                    histCurrent[node.axis]++;
                    node.color = colors[count++];   //assigning a color for the node
                    uniqueNodes.push(node); //pushing the node in the array uniqueNodes
                })
            });
            if (!(typeof _config.nodes === 'undefined' || _config.nodes === null)) {
                /*
                    If a list of nodes was passed, potential additional nodes should be shown on the axis
                */
                uniqueAxis.forEach(function (axisName) {
                    hist[axisName] = 0;
                    histCurrent[axisName] = 1
                });
                var count = 0;
                colors = randomColor({ count: _config.nodes.length, hue: nodesColorSchema });   //getting an array with several different colors but with the same hue.
                _config.nodes.forEach(function (node) {
                    /*
                        The array of nodes which was passed (_config.nodes) is always longer than unique nodes. This loop iterates through the _config.nodes and assignes the values from uniqueNodes
                        to the corresponding node in _config.nodes. If no matching node was found in uiqueNodes (catch case) the attributes 'value' and 'numberOfLinks' remain 0.
                        The nodes also get a color assigned.
                    */
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
                /*
                    At the moment _config.nodes is just one array with all nodes as objects. 'nodesByAxis' is an object with an array for each axis.
                    Each array includes the nodes for one axis.
                    By that we can sort the nodes of each axis individually, which will happen in the next loop.
                */
                var nodesByAxis = {};
                _config.nodes.forEach(function (node) {
                    /*
                        if an object for the axis already exists the node is pushed to the according array (else case). If the object doesn't exist yet the node is assigned as a first value in the array (if case)
                    */
                    if (nodesByAxis[node.axis] === undefined) {
                        nodesByAxis[node.axis] = [node];    //Assigning the first node to the array
                    }
                    else {
                        nodesByAxis[node.axis].push(node);  //Pushing an additional node in the array
                    }
                });
                /*
                    In the following the nodes on each axis are sorted by a criteria. The criteria can be different for each axis.
                    How the axis should be sorted is given in the object axisConfig under the variable 'sort'. The axis can be sorted in ascending or descending order (variable 'order')
                    If no specifications are given, the nodes are always sorted by the variable 'label' in ascending order
                    After the nodes are ordered the 'y' value is assigned to the nodes. Therefore the numbe rof nodes on each axis is counted and the nodes are equally spread.
                */
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
                        node.y = (histCurrent[node.axis] / hist[node.axis]);    //assigning the y value
                        histCurrent[node.axis]++;
                        listOfNodes.push(node);     //pushing the node in the listOfNodes array
                    });
                });

                uniqueNodes = JSON.parse(JSON.stringify(listOfNodes));  //create a clone of the array. Just by that we can continue working with the array. Without the clone the old values would be still there.
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
                Format of the passed variable:
                    'd' is the onformation about a link 

                Task of the function:
                    This function creates a tooltip if the mouse hovers over a link. The tooltip includes the information about the links (connections).
                    The tooltip says the source node, the target node and the value of the connection. 
                    The link is also highlighted.

                Format of the return value:
                    The function doesn't return a value but it displays a tooltip and highlights the link.
            */

            if (tooltipSetting !== 'none') {
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
                return p === d;     //the active link is highlighted by changing the class to 'hiveplot-active'
            });
            svg.selectAll(".hiveplot-link").classed("hiveplot-inactive", function (p) {
                return p !== d;     //all other links are hidden by changing the class to 'hiveplot-inactive'
            });
        }
        function nodeMouseover(d) {
            /*
                Format of the passed variable:
                    'd' is the information about a node

                Task of the function:
                    This function creates a tooltip if the mouse hovers over a node. The tooltip includes information about the node and the nodes to which it is connected.
                    The tooltip is just shown if tooltipSetting indicates that a tooltip should be shown (if case)
                    The links to and from this node are also highlighted.

                Format of the return value:
                    The function doesn't return a value but it displays a tooltip and highlights links connected to the node.
            */

            if (tooltipSetting !== 'none') { //creating a tooltip if tooltipSetting is not 'none'
                var detailstext = d.axis + '<h4 class=hiveplot-h4>' + d.label + ' (' + d.value + ')</h4>';
                var data = links.filter(function (obj) {
                    return (obj.source === d || obj.target === d)   //reducing the links to the ones which are connected with the node
                });

                var uniqueAxis = [];    //creating a list of the axes to which the node is connected nad on which the node itself lies
                data.forEach(function (d) {
                    uniqueAxis.push(d.source.axis);
                    uniqueAxis.push(d.target.axis);
                });
                uniqueAxis = (uniqueAxis.filter(function onlyUnique(value, index, self) { return self.indexOf(value) === index; }));    //removing duplicates from the array
                uniqueAxis = uniqueAxis.filter(function (obj) {
                    return (obj !== d.axis);    //removing the axis on which the node itself lies
                });

                uniqueAxis.forEach(function (axis) {
                    //creating a list of the nodes to which the node is connected. The information is grouped in paragraphs. Each paragraph is for one axis
                    var details = [];
                    var countData = 0;
                    data.forEach(function (datapoint) {
                        if (datapoint.source.axis === axis) {
                            var object = {
                                "axis": datapoint.source.axis,
                                "color": datapoint.source.color,
                                "label": datapoint.source.label,
                                "data": datapoint.value
                            }
                            countData = countData + datapoint.value;    //counting the total value of links to nodes on the one axis
                            details.push(object);
                        }
                        else if (datapoint.target.axis === axis) {
                            var object = {
                                "axis": datapoint.target.axis,
                                "color": datapoint.target.color,
                                "label": datapoint.target.label,
                                "data": datapoint.value
                            }
                            countData = countData + datapoint.value;    //counting the total value of links to nodes on the one axis
                            details.push(object);
                        }
                    });
                    details = sortBy(details, sortingTooltip, !sortingOrderTooltip);    //sorting the information in the tooltip. The information can be sorted by any of its attributes: axis, color, label, data
                    detailstext = detailstext + '<h5 class=hiveplot-h5>' + axis + ' (' + countData + ')' + '</h5>';
                    details.forEach(function (d) {
                        detailstext = detailstext + '' + (queryColorDot(d.color, 15) + ' '  + d.label  + ' (' + d.data + ')' + (tooltipOrientation==="horizontal" ? ',' : '<br/>'));
                    })
                });

                showTooltip(100, 0.9, detailstext, d3.event.pageX + 15, d3.event.pageY);
            }

            svg.selectAll(".hiveplot-link").classed("hiveplot-active", function (p) {
                return p.source === d || p.target === d;     //nodes which are connected to the link are highlighted by changing the class to 'hiveplot-active'
            });
            svg.selectAll(".hiveplot-link").classed("hiveplot-inactive", function (p) {
                return p.source !== d && p.target !== d;     //nodes which are not connected to the link are hidden by changing the class to 'hiveplot-inactive'
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
            /*
                Format of the passed variable:
                    The variable give some information about the style and content of the tooltip
                    duration: says how long it takes until the tooltip appears
                    opacity: defines the opacity of the background of the tooltip
                    text: is the text shown in the tooltip
                    posLeft, posTop: indicates where the tooltip in relation to the mouse should be shown

                Task of the function:
                    This function makes the tooltip visible. The tooltip either appears as a movable box next to the mouse or fixed to a specific position.

                Format of the return value:
                    The function doesn't return a value but it displays a tooltip
            */
            if (tooltipSetting === 'movable') {
                //if the tooltip should be movable the <div> for the tooltip is created dynamically
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
            else {
                //if the tooltip should appear at a fixed position the div is created in a specific position which is defined in 'tooltipElem'
                var tooltip = d3.select("#" + tooltipElem).append("div")
                    .attr("id", "tooltip")
                    .attr("class", "hiveplot-tooltip-fix");
                tooltip.transition()
                    .duration(duration)
                    .style("opacity", opacity);
                tooltip.html(text);
            }
        }
        function queryColorDot(color, diameter) {
            /*
                Format of the passed variable:
                    color: the color of the dot
                    diameter: the size of the dot

                Task of the function:
                    This function creates a colored dot in html with a specific color and diameter

                Format of the return value:
                    The function returns html code for a colored dot
            */
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

        function generateColorGradient(startColor, endColor, numberOfNuances) {
            /*
                Format of the passed variable:
                    startColor: A color in hexcode where the colorgradient should start
                    endColor: A color in hexcode where the colorgradient should end
                    numberOfNuances: the number of different nuances

                Task of the function:
                    This function creates a colorgradient between the two colors startColor and endColor with several nuances

                Format of the return value:
                    The function returns an array of the length numberOfNuances with different colors.
            */
            var startRedPart = startColor.slice(1, 3),
                startGreenPart = startColor.slice(3, 5),
                startBluePart = startColor.slice(5, 7),
                endRedPart = endColor.slice(1, 3),
                endGreenPart = endColor.slice(3, 5),
                endBluePart = endColor.slice(5, 7);

            var redNuances =  Math.round((parseInt(endRedPart, 16) - parseInt(startRedPart, 16)) / numberOfNuances),
                greenNuances = Math.round((parseInt(endGreenPart, 16) - parseInt(startGreenPart, 16)) / numberOfNuances),
                blueNuances =  Math.round((parseInt(endBluePart, 16) - parseInt(startBluePart, 16)) / numberOfNuances);
            var colorset = [];
            for (var count = 0; count < numberOfNuances; count++) {
                var redPart = (parseInt(startRedPart, 16) + count * redNuances).toString(16),
                    greenPart = (parseInt(startGreenPart, 16) + count * greenNuances).toString(16),
                    bluePart = (parseInt(startBluePart, 16) + count * blueNuances).toString(16),

                    color = '#' + (redPart.length === 1 ? '0' + redPart : redPart) + ''
                    + (greenPart.length === 1 ? '0' + greenPart : greenPart) + ''
                    + (bluePart.length === 1 ? '0' + bluePart : bluePart);
                colorset.push(color);
            }
            return colorset;
        }
    }
}).call(this);